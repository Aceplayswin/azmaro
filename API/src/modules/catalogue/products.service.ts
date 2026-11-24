import Decimal from "decimal.js";
import { db, join, likeContains, limitOffset, raw, sql, where, type Db, type Sql } from "../../db";
import { buildMeta, toSkipTake } from "../../utils/pagination";
import { money } from "../../utils/money";
import { notFound } from "../../utils/errors";
import { loadProducts, toProductCard, toProductDetail, type ProductCardRow } from "./catalogue.mapper";
import type { ProductListQuery } from "./products.schemas";
import { SCENT_SYNONYMS, scoreProduct, searchTerms } from "./search";

/**
 * Product queries. Conditions refer to `p` (products) and `b` (its brand) –
 * always select from PRODUCTS_FROM.
 */
export const PRODUCTS_FROM = raw("FROM products p JOIN brands b ON b.id = p.brandId");

/** Only published products from published brands are visible publicly. */
export const publicProductWhere: Sql = raw("p.isPublished = 1 AND b.isPublished = 1");

const inCategory = (slugs: string[] | string) =>
  sql`EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON c.id = pc.categoryId WHERE pc.productId = p.id AND c.slug IN (${slugs}))`;

function termCondition(term: string): Sql {
  const like = likeContains(term);
  const or: Sql[] = [
    sql`p.name LIKE ${like}`,
    sql`p.catalogueName LIKE ${like}`,
    sql`p.brandLabel LIKE ${like}`,
    sql`b.name LIKE ${like}`,
    sql`p.fragranceFamily LIKE ${like}`,
    sql`p.scentCharacter LIKE ${like}`,
    sql`(p.noteBasis = 'PUBLISHED' AND (p.topNotes LIKE ${like} OR p.heartNotes LIKE ${like} OR p.baseNotes LIKE ${like}))`,
  ];
  const synonym = SCENT_SYNONYMS[term];
  if (synonym) or.push(inCategory(synonym));
  return sql`(${join(or, " OR ")})`;
}

export function buildProductWhere(q: Omit<ProductListQuery, "page" | "pageSize" | "sort">, base: Sql = publicProductWhere): Sql {
  const and: Sql[] = [base];
  if (q.q) for (const term of searchTerms(q.q)) and.push(termCondition(term));
  if (q.brand.length) and.push(sql`b.slug IN (${q.brand})`);
  if (q.family.length) and.push(inCategory(q.family));
  if (q.gender.length) and.push(sql`p.gender IN (${q.gender})`);
  if (q.concentration.length) and.push(sql`p.concentration IN (${q.concentration})`);
  if (q.size.length) and.push(sql`EXISTS (SELECT 1 FROM product_variants v WHERE v.productId = p.id AND v.isActive = 1 AND v.sizeMl IN (${q.size}))`);
  if (q.minPrice !== undefined) and.push(sql`p.minPrice >= ${money(q.minPrice)}`);
  if (q.maxPrice !== undefined) and.push(sql`p.minPrice <= ${money(q.maxPrice)}`);
  if (q.featured !== undefined) and.push(sql`p.isFeatured = ${q.featured}`);
  if (q.purchasable) and.push(raw("p.minPrice IS NOT NULL"));
  if (q.tag === "new") and.push(raw("p.isNew = 1"));
  if (q.tag === "bestseller") and.push(raw("p.isBestseller = 1"));
  return join(and, " AND ");
}

/** ORDER BY clauses (NULL prices sort last). */
export const PRODUCT_ORDER: Record<string, Sql> = {
  featured: raw("ORDER BY p.isFeatured DESC, p.featuredRank IS NULL, p.featuredRank ASC, p.noteBasis ASC, p.sortOrder ASC"),
  "name-asc": raw("ORDER BY p.name ASC"),
  "name-desc": raw("ORDER BY p.name DESC"),
  brand: raw("ORDER BY b.name ASC, p.name ASC"),
  "price-asc": raw("ORDER BY p.minPrice IS NULL, p.minPrice ASC, p.name ASC"),
  "price-desc": raw("ORDER BY p.minPrice IS NULL, p.minPrice DESC, p.name ASC"),
  newest: raw("ORDER BY p.createdAt DESC"),
  catalogue: raw("ORDER BY p.sortOrder ASC"),
  "featured-rank": raw("ORDER BY p.featuredRank IS NULL, p.featuredRank ASC, p.sortOrder ASC"),
};

/** Ids of matching products (ordered, optionally paged). */
export async function findProductIds(condition: Sql, order: Sql = raw(""), page?: { skip: number; take: number }, ex: Db = db) {
  const rows = await ex.many<{ id: string }>(sql`SELECT p.id ${PRODUCTS_FROM} ${where([condition])} ${order} ${page ? limitOffset(page) : raw("")}`);
  return rows.map((r) => r.id);
}

export async function countProducts(condition: Sql, ex: Db = db) {
  const row = await ex.one<{ n: number }>(sql`SELECT COUNT(*) AS n ${PRODUCTS_FROM} ${where([condition])}`);
  return row?.n ?? 0;
}

/** Find + load product cards in one call. */
export async function findProductCards(condition: Sql, order?: Sql, page?: { skip: number; take: number }) {
  return loadProducts(await findProductIds(condition, order, page));
}

export async function listProducts(query: ProductListQuery) {
  const condition = buildProductWhere(query);
  const sort = query.sort ?? (query.q ? "relevance" : "featured");

  // Relevance ranking happens in memory over the (already filtered) match set.
  if (sort === "relevance" && query.q) {
    const rows = await findProductCards(condition);
    const terms = searchTerms(query.q);
    const ranked = rows
      .map((r) => ({ r, s: scoreProduct(r, terms) }))
      .sort((a, b) => b.s - a.s || a.r.name.localeCompare(b.r.name))
      .map((x) => x.r);
    const { skip, take } = toSkipTake(query);
    return { items: ranked.slice(skip, skip + take).map(toProductCard), meta: buildMeta(query, ranked.length) };
  }

  const [total, rows] = await Promise.all([
    countProducts(condition),
    findProductCards(condition, PRODUCT_ORDER[sort] ?? PRODUCT_ORDER.featured, toSkipTake(query)),
  ]);
  return { items: rows.map(toProductCard), meta: buildMeta(query, total) };
}

export async function getProductBySlug(slug: string) {
  const [id] = await findProductIds(sql`p.slug = ${slug} AND ${publicProductWhere}`);
  const [product] = id ? await loadProducts([id], { images: "detail" }) : [];
  if (!product) throw notFound("Product");
  return product;
}

export async function getProductDetail(slug: string) {
  const product = await getProductBySlug(slug);
  return { product: toProductDetail(product), related: await relatedProducts(product) };
}

export async function relatedProducts(product: ProductCardRow, limit = 4) {
  const familyIds = product.categories.map((c) => c.categoryId);
  const candidates = await findProductCards(
    sql`${publicProductWhere} AND p.id <> ${product.id} AND (p.brandId = ${product.brandId} OR EXISTS (SELECT 1 FROM product_categories pc WHERE pc.productId = p.id AND pc.categoryId IN (${familyIds})))`,
    raw(""),
    { skip: 0, take: 40 },
  );
  const score = (p: ProductCardRow) =>
    (p.brandId === product.brandId ? 2 : 0) +
    p.categories.filter((c) => familyIds.includes(c.categoryId)).length +
    (p.noteBasis === "PUBLISHED" ? 0.5 : 0);
  return candidates
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(toProductCard);
}

/** Facet values derived from live data so filters never offer empty options. */
export async function productFacets() {
  const [brands, families, genders, concentrations, sizes, price] = await Promise.all([
    db.many<{ slug: string; name: string; count: number }>(sql`
      SELECT b.slug, b.name, COUNT(p.id) AS count
      FROM brands b JOIN products p ON p.brandId = b.id AND p.isPublished = 1
      WHERE b.isPublished = 1
      GROUP BY b.id ORDER BY b.name ASC`),
    db.many<{ slug: string; name: string; count: number }>(sql`
      SELECT c.slug, c.name,
        (SELECT COUNT(*) FROM product_categories pc JOIN products p ON p.id = pc.productId JOIN brands b ON b.id = p.brandId
         WHERE pc.categoryId = c.id AND ${publicProductWhere}) AS count
      FROM categories c WHERE c.type = 'SCENT_FAMILY' AND c.isPublished = 1
      ORDER BY c.sortOrder ASC`),
    db.many<{ value: string; count: number }>(
      sql`SELECT p.gender AS value, COUNT(*) AS count ${PRODUCTS_FROM} WHERE ${publicProductWhere} AND p.gender IS NOT NULL GROUP BY p.gender ORDER BY p.gender`,
    ),
    db.many<{ value: string; count: number }>(
      sql`SELECT p.concentration AS value, COUNT(*) AS count ${PRODUCTS_FROM} WHERE ${publicProductWhere} AND p.concentration IS NOT NULL GROUP BY p.concentration ORDER BY p.concentration`,
    ),
    db.many<{ sizeMl: number; count: number }>(sql`
      SELECT v.sizeMl, COUNT(*) AS count FROM product_variants v JOIN products p ON p.id = v.productId JOIN brands b ON b.id = p.brandId
      WHERE v.isActive = 1 AND ${publicProductWhere} GROUP BY v.sizeMl ORDER BY v.sizeMl ASC`),
    db.one<{ min: Decimal | null; max: Decimal | null }>(
      sql`SELECT MIN(p.minPrice) AS min, MAX(p.minPrice) AS max ${PRODUCTS_FROM} WHERE ${publicProductWhere} AND p.minPrice IS NOT NULL`,
    ),
  ]);
  return {
    brands: brands.map((b) => ({ slug: b.slug, name: b.name, count: b.count })),
    families: families.filter((f) => f.count > 0).map((f) => ({ slug: f.slug, name: f.name, count: f.count })),
    genders: genders.map((g) => ({ value: g.value, count: g.count })),
    concentrations: concentrations.map((c) => ({ value: c.value, count: c.count })),
    sizes: sizes.map((s) => ({ sizeMl: s.sizeMl, count: s.count })),
    price: price?.min && price.max ? { min: Number(price.min), max: Number(price.max) } : null,
  };
}

/** Keep products.minPrice in sync after any price change (call inside the same transaction). */
export async function recomputeMinPrice(productId: string, ex: Db = db) {
  await ex.run(sql`
    UPDATE products SET minPrice = (
      SELECT MIN(v.price) FROM product_variants v WHERE v.productId = ${productId} AND v.isActive = 1 AND v.price IS NOT NULL
    ) WHERE id = ${productId}`);
}
