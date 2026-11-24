import type { Request, Response } from "express";
import { z } from "zod";
import { db, raw, sql, type BrandRow, type CategoryRow } from "../../db";
import { notFound } from "../../utils/errors";
import { buildMeta, paginationQuery, toSkipTake } from "../../utils/pagination";
import { ok, paginated } from "../../utils/response";
import { booleanQuery, slug } from "../../validators/common";
import { toProductCard } from "./catalogue.mapper";
import { productListQuery } from "./products.schemas";
import { countProducts, findProductCards, getProductDetail, listProducts, productFacets, publicProductWhere } from "./products.service";

export const brandListQuery = z.object({ featured: booleanQuery.optional() });
export const brandProductsQuery = paginationQuery.extend({ sort: z.enum(["featured", "name-asc", "price-asc", "price-desc"]).optional() });
export const categoryListQuery = z.object({ type: z.enum(["SCENT_FAMILY", "COLLECTION"]).optional() });

// ─── Products ───

export async function listProductsHandler(req: Request, res: Response) {
  const query = productListQuery.parse(req.query);
  const { items, meta } = await listProducts(query);
  return paginated(res, items, meta);
}

export async function productDetailHandler(req: Request, res: Response) {
  return ok(res, await getProductDetail(slug.parse(req.params.slug)));
}

export async function facetsHandler(_req: Request, res: Response) {
  return ok(res, await productFacets());
}

// ─── Brands ───

const brandDto = (b: { id: string; slug: string; name: string; description: string | null; imageUrl: string | null; isFeatured: boolean }, productCount: number) => ({
  id: b.id,
  slug: b.slug,
  name: b.name,
  description: b.description,
  imageUrl: b.imageUrl,
  isFeatured: b.isFeatured,
  productCount,
});

/** Published brands with their number of published products (only brands that have some). */
export async function publishedBrands(opts: { featured?: boolean; slug?: string } = {}) {
  return db.many<BrandRow & { productCount: number }>(sql`
    SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brandId = b.id AND p.isPublished = 1) AS productCount
    FROM brands b
    WHERE b.isPublished = 1
      ${opts.featured ? raw("AND b.isFeatured = 1") : raw("")}
      ${opts.slug ? sql`AND b.slug = ${opts.slug}` : raw("")}
    HAVING productCount > 0
    ${opts.featured ? raw("ORDER BY b.featuredRank IS NULL, b.featuredRank ASC, b.name ASC") : raw("ORDER BY b.name ASC")}`);
}

/** Directory of published brands that have at least one published product. */
export async function listBrandsHandler(req: Request, res: Response) {
  const { featured } = brandListQuery.parse(req.query);
  const brands = await publishedBrands({ featured });
  return ok(res, brands.map((b) => brandDto(b, b.productCount)));
}

export async function brandDetailHandler(req: Request, res: Response) {
  const [brand] = await publishedBrands({ slug: slug.parse(req.params.slug) });
  if (!brand) throw notFound("Brand");
  return ok(res, brandDto(brand, brand.productCount));
}

export async function brandProductsHandler(req: Request, res: Response) {
  const brandSlug = slug.parse(req.params.slug);
  const query = brandProductsQuery.parse(req.query);
  const condition = sql`${publicProductWhere} AND b.slug = ${brandSlug}`;
  const order =
    query.sort === "name-asc"
      ? raw("ORDER BY p.name ASC")
      : query.sort === "price-asc"
        ? raw("ORDER BY p.minPrice IS NULL, p.minPrice ASC")
        : query.sort === "price-desc"
          ? raw("ORDER BY p.minPrice IS NULL, p.minPrice DESC")
          : raw("ORDER BY p.isFeatured DESC, p.sortOrder ASC");
  const [total, rows] = await Promise.all([countProducts(condition), findProductCards(condition, order, toSkipTake(query))]);
  return paginated(res, rows.map(toProductCard), buildMeta(query, total));
}

// ─── Categories ───

export async function listCategoriesHandler(req: Request, res: Response) {
  const { type } = categoryListQuery.parse(req.query);
  const categories = await db.many<CategoryRow & { productCount: number }>(sql`
    SELECT c.*,
      (SELECT COUNT(*) FROM product_categories pc JOIN products p ON p.id = pc.productId JOIN brands b ON b.id = p.brandId
       WHERE pc.categoryId = c.id AND ${publicProductWhere}) AS productCount
    FROM categories c
    WHERE c.isPublished = 1 ${type ? sql`AND c.type = ${type}` : raw("")}
    ORDER BY c.type ASC, c.sortOrder ASC`);
  return ok(
    res,
    categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      shortName: c.shortName,
      description: c.description,
      type: c.type,
      imageUrl: c.imageUrl,
      productCount: c.productCount,
    })),
  );
}

export async function categoryDetailHandler(req: Request, res: Response) {
  const category = await db.one<CategoryRow>(sql`SELECT * FROM categories WHERE slug = ${slug.parse(req.params.slug)} AND isPublished = 1`);
  if (!category) throw notFound("Category");
  return ok(res, category);
}
