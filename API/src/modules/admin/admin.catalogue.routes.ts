import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Request } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { randomToken } from "../../utils/crypto";
import {
  db,
  insert,
  insertMany,
  join,
  likeContains,
  raw,
  sql,
  transaction,
  update,
  type BrandRow,
  type CategoryRow,
  type Db,
  type InventoryRow,
  type ProductImageRow,
  type ProductVariantRow,
  type Sql,
} from "../../db";
import { moduleRouter } from "../../routes/router";
import { AppError, conflict, notFound, unprocessable } from "../../utils/errors";
import { money, toAmount } from "../../utils/money";
import { buildMeta, paginationQuery, toSkipTake } from "../../utils/pagination";
import { created, ok, paginated } from "../../utils/response";
import { booleanQuery, id, nonEmpty, slug } from "../../validators/common";
import { loadProducts, toVariantDto, withInventory, type ProductCardRow } from "../catalogue/catalogue.mapper";
import { countProducts, findProductIds, recomputeMinPrice } from "../catalogue/products.service";
import { audit } from "./audit";

// ─────────── Schemas ───────────

const nullableMoney = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => (v === null || v === "" ? null : String(v)))
  .refine((v) => v === null || (/^\d{1,8}(\.\d{1,2})?$/.test(v) && Number(v) > 0), "Use a positive amount with up to 2 decimals, or null.");

const variantInput = z.object({
  sizeMl: z.number().int().positive().max(5000),
  sku: z.string().trim().max(64).nullable().optional(),
  price: nullableMoney.optional(),
  mrp: nullableMoney.optional(),
  isActive: z.boolean().optional(),
});

const productBase = z.object({
  slug,
  name: nonEmpty("Name", 160),
  catalogueName: z.string().trim().max(200).optional(),
  brandSlug: slug,
  brandLabel: z.string().trim().max(160).optional(),
  fragranceFamily: nonEmpty("Fragrance family", 160),
  noteBasis: z.enum(["PUBLISHED", "EDITORIAL_IMPRESSION"]),
  topNotes: nonEmpty("Top notes", 2000),
  heartNotes: nonEmpty("Heart notes", 2000),
  baseNotes: nonEmpty("Base notes", 2000),
  scentCharacter: nonEmpty("Scent character", 2000),
  description: z.string().trim().max(5000).nullable().optional(),
  occasions: nonEmpty("Occasions", 255),
  season: nonEmpty("Season", 255),
  targetAudience: z.string().trim().max(160).nullable().optional(),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]).nullable().optional(),
  concentration: z.enum(["EDP", "EXTRAIT", "EDT", "ATTAR"]).nullable().optional(),
  concentrationNote: z.string().trim().max(255).nullable().optional(),
  researchBasis: z.string().trim().max(2000).nullable().optional(),
  reviewNote: z.string().trim().max(255).nullable().optional(),
  inventorySizeMl: z.number().int().positive().nullable().optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  featuredRank: z.number().int().min(0).nullable().optional(),
  isNew: z.boolean().optional(),
  isBestseller: z.boolean().optional(),
  categorySlugs: z.array(slug).max(20).optional(),
});

export const productCreateSchema = productBase.extend({ variants: z.array(variantInput).max(10).default([]) });
export const productUpdateSchema = productBase.partial();

const priceItem = z
  .object({
    variantId: id.optional(),
    productSlug: slug.optional(),
    sizeMl: z.number().int().positive().optional(),
    price: nullableMoney,
    mrp: nullableMoney.optional(),
  })
  .refine((v) => v.variantId || (v.productSlug && v.sizeMl), "Provide variantId, or productSlug + sizeMl.");
export const pricingSchema = z.object({ items: z.array(priceItem).min(1).max(500) });

export const inventorySchema = z.object({
  quantity: z.number().int().min(0).nullable(),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "PREORDER"]).nullable().optional(),
  lowStockAt: z.number().int().min(0).nullable().optional(),
});

const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^\/images\/[A-Za-z0-9/_.-]+$/.test(v) || /^https:\/\/[^\s]+$/.test(v), "Use a /images/... path or an https URL.");

export const imageCreateSchema = z.object({
  url: imageUrl,
  alt: nonEmpty("Alt text", 255),
  sortOrder: z.number().int().min(0).default(0),
  status: z.enum(["APPROVED", "PENDING_REVIEW", "REJECTED"]).default("PENDING_REVIEW"),
  sourceUrl: z.string().url().max(1000).nullable().optional(),
  sourcePageUrl: z.string().url().max(1000).nullable().optional(),
  workbookStatus: z.string().max(60).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export const imageUpdateSchema = imageCreateSchema.partial();

export const brandSchema = z.object({
  slug,
  name: nonEmpty("Name", 120),
  description: z.string().trim().max(5000).nullable().optional(),
  imageUrl: imageUrl.nullable().optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  featuredRank: z.number().int().min(0).nullable().optional(),
});

export const categorySchema = z.object({
  slug,
  name: nonEmpty("Name", 120),
  shortName: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  type: z.enum(["SCENT_FAMILY", "COLLECTION"]),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: imageUrl.nullable().optional(),
  isPublished: z.boolean().optional(),
});

export const adminProductQuery = paginationQuery.extend({
  q: z.string().trim().max(80).optional(),
  brand: slug.optional(),
  published: booleanQuery.optional(),
  priced: booleanQuery.optional(),
  imageStatus: z.enum(["missing", "pending", "approved"]).optional(),
  sort: z.enum(["catalogue", "name-asc", "name-desc", "brand", "brand-desc", "price-asc", "price-desc", "updated-desc", "updated-asc", "created-desc"]).default("catalogue"),
});

/** ORDER BY for the admin product grid (id breaks ties so paging is stable). */
const ADMIN_PRODUCT_ORDER: Record<z.infer<typeof adminProductQuery>["sort"], Sql> = {
  catalogue: raw("ORDER BY p.sortOrder ASC, p.id ASC"),
  "name-asc": raw("ORDER BY p.name ASC, p.id ASC"),
  "name-desc": raw("ORDER BY p.name DESC, p.id ASC"),
  brand: raw("ORDER BY b.name ASC, p.name ASC, p.id ASC"),
  "brand-desc": raw("ORDER BY b.name DESC, p.name ASC, p.id ASC"),
  "price-asc": raw("ORDER BY p.minPrice IS NULL, p.minPrice ASC, p.name ASC, p.id ASC"),
  "price-desc": raw("ORDER BY p.minPrice IS NULL, p.minPrice DESC, p.name ASC, p.id ASC"),
  "updated-desc": raw("ORDER BY p.updatedAt DESC, p.id ASC"),
  "updated-asc": raw("ORDER BY p.updatedAt ASC, p.id ASC"),
  "created-desc": raw("ORDER BY p.createdAt DESC, p.id ASC"),
};

// ─────────── Helpers ───────────

type AdminProductRow = ProductCardRow;

const loadAdminProduct = async (productId: string, ex: Db = db) =>
  (await loadProducts([productId], { images: "all", variants: "all" }, ex))[0] ?? null;

const adminProductDto = (p: AdminProductRow) => ({
  ...p,
  minPrice: toAmount(p.minPrice),
  brand: { id: p.brand.id, slug: p.brand.slug, name: p.brand.name },
  variants: p.variants.map((v) => ({ ...toVariantDto(v), isActive: v.isActive, inventory: v.inventory })),
  categories: p.categories.map((c) => ({ slug: c.category.slug, name: c.category.name, type: c.category.type })),
});

function checkMrp(price: string | null | undefined, mrp: string | null | undefined) {
  if (price && mrp && money(mrp).lessThan(money(price))) throw unprocessable("MRP cannot be lower than the selling price.", undefined, "MRP_BELOW_PRICE");
}

async function categoryIds(slugs: string[] | undefined) {
  if (!slugs) return undefined;
  const cats = await db.many<CategoryRow>(sql`SELECT * FROM categories WHERE slug IN (${slugs})`);
  const missing = slugs.filter((s) => !cats.some((c) => c.slug === s));
  if (missing.length) throw unprocessable(`Unknown categories: ${missing.join(", ")}`, undefined, "UNKNOWN_CATEGORY");
  return cats.map((c) => c.id);
}

async function brandId(brandSlug: string) {
  const brand = await db.one<BrandRow>(sql`SELECT * FROM brands WHERE slug = ${brandSlug}`);
  if (!brand) throw unprocessable(`Unknown brand "${brandSlug}".`, undefined, "UNKNOWN_BRAND");
  return brand;
}

const countWhere = async (q: Sql) => (await db.one<{ n: number }>(q))?.n ?? 0;

/** Insert a variant together with its (untracked) inventory row. */
async function createVariant(ex: Db, productId: string, v: z.infer<typeof variantInput>) {
  const variantId = await insert(ex, "product_variants", {
    productId,
    sizeMl: v.sizeMl,
    sku: v.sku ?? null,
    price: v.price ?? null,
    mrp: v.mrp ?? null,
    isActive: v.isActive ?? true,
  });
  await insert(ex, "inventory", { variantId });
  return variantId;
}

async function loadVariant(ex: Db, variantId: string) {
  const v = await ex.one<ProductVariantRow>(sql`SELECT * FROM product_variants WHERE id = ${variantId}`);
  return v ? (await withInventory([v], ex))[0]! : null;
}

/** Throw 404 when an UPDATE / DELETE matched no row. */
const found = (matched: number, what: string) => {
  if (!matched) throw notFound(what);
};

// ─────────── Routes ───────────

export const adminCatalogueRoutes = moduleRouter("/admin", "Admin · Catalogue");
const r = adminCatalogueRoutes;

r.get("/products", { summary: "List all products (incl. unpublished)", auth: "admin", permission: "products:read", query: adminProductQuery }, async (req, res) => {
  const q = adminProductQuery.parse(req.query);
  const like = q.q ? likeContains(q.q) : null;
  const condition = join(
    [
      like ? sql`(p.name LIKE ${like} OR p.slug LIKE ${like} OR p.catalogueName LIKE ${like})` : raw(""),
      q.brand ? sql`b.slug = ${q.brand}` : raw(""),
      q.published !== undefined ? sql`p.isPublished = ${q.published}` : raw(""),
      q.priced !== undefined ? raw(q.priced ? "p.minPrice IS NOT NULL" : "p.minPrice IS NULL") : raw(""),
      q.imageStatus === "missing" ? raw("NOT EXISTS (SELECT 1 FROM product_images i WHERE i.productId = p.id)") : raw(""),
      q.imageStatus === "pending" ? raw("EXISTS (SELECT 1 FROM product_images i WHERE i.productId = p.id AND i.status = 'PENDING_REVIEW')") : raw(""),
      q.imageStatus === "approved" ? raw("EXISTS (SELECT 1 FROM product_images i WHERE i.productId = p.id AND i.status = 'APPROVED')") : raw(""),
    ],
    " AND ",
  );
  const [total, ids] = await Promise.all([countProducts(condition), findProductIds(condition, ADMIN_PRODUCT_ORDER[q.sort], toSkipTake(q))]);
  const rows = await loadProducts(ids, { images: "all", variants: "all" });
  return paginated(res, rows.map(adminProductDto), buildMeta(q, total));
});

r.get("/products/:id", { summary: "Product (admin view)", auth: "admin", permission: "products:read" }, async (req, res) => {
  const p = await loadAdminProduct(id.parse(req.params.id));
  if (!p) throw notFound("Product");
  return ok(res, adminProductDto(p));
});

r.post("/products", { summary: "Create a product", auth: "admin", permission: "products:write", body: productCreateSchema, successStatus: 201 }, async (req, res) => {
  const input = productCreateSchema.parse(req.body);
  const brand = await brandId(input.brandSlug);
  const cats = await categoryIds(input.categorySlugs);
  input.variants.forEach((v) => checkMrp(v.price, v.mrp));
  const { brandSlug, categorySlugs, variants, ...data } = input;
  void brandSlug;
  void categorySlugs;
  const product = await transaction(async (tx) => {
    const productId = await insert(tx, "products", {
      ...data,
      catalogueName: data.catalogueName ?? data.name,
      brandLabel: data.brandLabel ?? brand.name,
      brandId: brand.id,
    });
    if (cats) await insertMany(tx, "product_categories", cats.map((categoryId) => ({ productId, categoryId })), { id: false });
    for (const v of variants) await createVariant(tx, productId, v);
    await recomputeMinPrice(productId, tx);
    return (await loadAdminProduct(productId, tx))!;
  });
  await audit(req, "product.create", "product", product.id, { slug: product.slug });
  return created(res, adminProductDto(product), "Product created.");
});

r.patch("/products/:id", { summary: "Update a product (incl. featured / publish flags and categories)", auth: "admin", permission: "products:write", body: productUpdateSchema }, async (req, res) => {
  const productId = id.parse(req.params.id);
  const input = productUpdateSchema.parse(req.body);
  const existing = await db.one(sql`SELECT id FROM products WHERE id = ${productId}`);
  if (!existing) throw notFound("Product");
  const brand = input.brandSlug ? await brandId(input.brandSlug) : null;
  const cats = await categoryIds(input.categorySlugs);
  const { brandSlug, categorySlugs, ...data } = input;
  void brandSlug;
  void categorySlugs;
  const product = await transaction(async (tx) => {
    if (cats) {
      await tx.run(sql`DELETE FROM product_categories WHERE productId = ${productId}`);
      await insertMany(tx, "product_categories", cats.map((categoryId) => ({ productId, categoryId })), { id: false });
    }
    await update(tx, "products", { ...data, ...(brand ? { brandId: brand.id } : {}) }, sql`id = ${productId}`);
    return (await loadAdminProduct(productId, tx))!;
  });
  await audit(req, "product.update", "product", productId, { fields: Object.keys(input) });
  return ok(res, adminProductDto(product), "Product updated.");
});

r.delete("/products/:id", { summary: "Delete a product (only if it has never been ordered – otherwise unpublish it)", auth: "admin", permission: "products:write" }, async (req, res) => {
  const productId = id.parse(req.params.id);
  const ordered = await countWhere(sql`SELECT COUNT(*) AS n FROM order_items WHERE productId = ${productId}`);
  if (ordered) throw conflict("This product appears in orders. Unpublish it instead of deleting.", undefined, "PRODUCT_IN_ORDERS");
  found((await db.run(sql`DELETE FROM products WHERE id = ${productId}`)).affectedRows, "Product");
  await audit(req, "product.delete", "product", productId);
  return ok(res, null, "Product deleted.");
});

// Variants
r.post("/products/:id/variants", { summary: "Add a size variant", auth: "admin", permission: "products:write", body: variantInput, successStatus: 201 }, async (req, res) => {
  const productId = id.parse(req.params.id);
  const input = variantInput.parse(req.body);
  checkMrp(input.price, input.mrp);
  const variant = await transaction(async (tx) => {
    const variantId = await createVariant(tx, productId, input);
    await recomputeMinPrice(productId, tx);
    return (await loadVariant(tx, variantId))!;
  });
  await audit(req, "variant.create", "variant", variant.id, { productId, sizeMl: input.sizeMl });
  return created(res, toVariantDto(variant), "Variant added.");
});

r.patch("/variants/:id", { summary: "Update a variant (size, SKU, price, MRP, active)", auth: "admin", permission: "pricing:write", body: variantInput.partial() }, async (req, res) => {
  const variantId = id.parse(req.params.id);
  const input = variantInput.partial().parse(req.body);
  const existing = await db.one<ProductVariantRow>(sql`SELECT * FROM product_variants WHERE id = ${variantId}`);
  if (!existing) throw notFound("Variant");
  checkMrp(input.price !== undefined ? input.price : existing.price?.toString(), input.mrp !== undefined ? input.mrp : existing.mrp?.toString());
  const variant = await transaction(async (tx) => {
    await update(tx, "product_variants", input, sql`id = ${variantId}`);
    await recomputeMinPrice(existing.productId, tx);
    return (await loadVariant(tx, variantId))!;
  });
  await audit(req, "variant.update", "variant", variantId, { fields: Object.keys(input), price: input.price, mrp: input.mrp });
  return ok(res, toVariantDto(variant), "Variant updated.");
});

r.delete("/variants/:id", { summary: "Delete a variant (deactivate instead if it has been ordered)", auth: "admin", permission: "products:write" }, async (req, res) => {
  const variantId = id.parse(req.params.id);
  const v = await db.one<ProductVariantRow>(sql`SELECT * FROM product_variants WHERE id = ${variantId}`);
  if (!v) throw notFound("Variant");
  if (await countWhere(sql`SELECT COUNT(*) AS n FROM order_items WHERE variantId = ${variantId}`))
    throw conflict("This size appears in orders. Deactivate it instead.", undefined, "VARIANT_IN_ORDERS");
  await transaction(async (tx) => {
    await tx.run(sql`DELETE FROM product_variants WHERE id = ${variantId}`);
    await recomputeMinPrice(v.productId, tx);
  });
  await audit(req, "variant.delete", "variant", variantId);
  return ok(res, null, "Variant deleted.");
});

// Pricing (bulk)
r.put("/pricing", {
  summary: "Bulk set verified prices / MRP",
  description: "Prices are only shown and purchasable once set here (or via the pricing import script). Use null to withdraw a price.",
  auth: "admin",
  permission: "pricing:write",
  body: pricingSchema,
}, async (req, res) => {
  const { items } = pricingSchema.parse(req.body);
  const updated = await transaction(async (tx) => {
    const touched = new Set<string>();
    const results: Array<{ variantId: string; price: number | null; mrp: number | null }> = [];
    for (const item of items) {
      const variant = item.variantId
        ? await tx.one<ProductVariantRow>(sql`SELECT * FROM product_variants WHERE id = ${item.variantId}`)
        : await tx.one<ProductVariantRow>(
            sql`SELECT v.* FROM product_variants v JOIN products p ON p.id = v.productId WHERE v.sizeMl = ${item.sizeMl ?? null} AND p.slug = ${item.productSlug ?? null} LIMIT 1`,
          );
      if (!variant) throw unprocessable(`Variant not found: ${item.variantId ?? `${item.productSlug} ${item.sizeMl}ml`}`, undefined, "UNKNOWN_VARIANT");
      const mrp = item.mrp !== undefined ? item.mrp : (variant.mrp?.toString() ?? null);
      checkMrp(item.price, mrp);
      await update(tx, "product_variants", { price: item.price, mrp }, sql`id = ${variant.id}`);
      touched.add(variant.productId);
      results.push({ variantId: variant.id, price: toAmount(item.price), mrp: toAmount(mrp) });
    }
    for (const productId of touched) await recomputeMinPrice(productId, tx);
    return results;
  });
  await audit(req, "pricing.bulk_update", "pricing", null, { count: updated.length });
  return ok(res, updated, `${updated.length} price(s) updated.`);
});

// Inventory
r.get("/inventory", { summary: "Inventory by variant", auth: "admin", permission: "products:read", query: paginationQuery.extend({ lowStock: booleanQuery.optional() }) }, async (req, res) => {
  const q = paginationQuery.extend({ lowStock: booleanQuery.optional() }).parse(req.query);
  const rows = await db.many<{
    variantId: string;
    productId: string;
    product: string;
    brand: string;
    slug: string;
    sizeMl: number;
    sku: string | null;
    quantity: number | null;
    stockStatus: string | null;
    lowStockAt: number | null;
  }>(sql`
    SELECT v.id AS variantId, p.id AS productId, p.name AS product, b.name AS brand, p.slug, v.sizeMl, v.sku, i.quantity, i.stockStatus, i.lowStockAt
    FROM product_variants v
    JOIN products p ON p.id = v.productId
    JOIN brands b ON b.id = p.brandId
    LEFT JOIN inventory i ON i.variantId = v.id
    ORDER BY p.sortOrder ASC, v.sizeMl ASC`);
  const filtered = q.lowStock ? rows.filter((v) => v.quantity !== null && v.quantity <= (v.lowStockAt ?? 5)) : rows;
  const { skip, take } = toSkipTake(q);
  return paginated(
    res,
    filtered.slice(skip, skip + take).map((v) => ({ ...v, tracked: v.quantity !== null })),
    buildMeta(q, filtered.length),
  );
});

r.put("/inventory/:variantId", {
  summary: "Set verified stock for a variant",
  description: "quantity=null means stock is not tracked. When tracked, checkout decrements it atomically and refuses to oversell.",
  auth: "admin",
  permission: "inventory:write",
  body: inventorySchema,
}, async (req, res) => {
  const variantId = id.parse(req.params.variantId);
  const input = inventorySchema.parse(req.body);
  if (!(await db.one(sql`SELECT id FROM product_variants WHERE id = ${variantId}`))) throw notFound("Variant");
  const matched = await update(
    db,
    "inventory",
    { quantity: input.quantity, stockStatus: input.stockStatus, lowStockAt: input.lowStockAt },
    sql`variantId = ${variantId}`,
  );
  if (!matched) await insert(db, "inventory", { variantId, quantity: input.quantity, stockStatus: input.stockStatus ?? null, lowStockAt: input.lowStockAt ?? null });
  const inv = await db.one<InventoryRow>(sql`SELECT * FROM inventory WHERE variantId = ${variantId}`);
  await audit(req, "inventory.update", "variant", variantId, input);
  return ok(res, inv, "Inventory updated.");
});

// Images
const findImage = (imageId: string) => db.one<ProductImageRow>(sql`SELECT * FROM product_images WHERE id = ${imageId}`);

r.post("/products/:id/images", { summary: "Attach a product image (pending review by default)", auth: "admin", permission: "products:write", body: imageCreateSchema, successStatus: 201 }, async (req, res) => {
  const productId = id.parse(req.params.id);
  const input = imageCreateSchema.parse(req.body);
  if (!(await db.one(sql`SELECT id FROM products WHERE id = ${productId}`))) throw notFound("Product");
  const image = (await findImage(await insert(db, "product_images", { ...input, productId })))!;
  await audit(req, "image.create", "product_image", image.id, { productId, status: image.status });
  return created(res, image, "Image added.");
});

r.patch("/images/:id", { summary: "Approve / reject / edit a product image", auth: "admin", permission: "products:write", body: imageUpdateSchema }, async (req, res) => {
  const imageId = id.parse(req.params.id);
  const input = imageUpdateSchema.parse(req.body);
  found(await update(db, "product_images", input, sql`id = ${imageId}`), "Image");
  const image = await findImage(imageId);
  await audit(req, "image.update", "product_image", imageId, { status: input.status });
  return ok(res, image, "Image updated.");
});

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Accepted image types, recognised by their leading bytes (the Content-Type header alone is not trusted). */
const IMAGE_SIGNATURES: Array<{ ext: string; test: (b: Buffer) => boolean }> = [
  { ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", test: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
  { ext: "avif", test: (b) => b.toString("ascii", 4, 12) === "ftypavif" || b.toString("ascii", 4, 12) === "ftypavis" },
];

/** Read the raw request body (only after auth has passed), refusing anything over `limit` bytes. */
async function readBody(req: Request, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limit) throw new AppError(413, "PAYLOAD_TOO_LARGE", `Images must be ${limit / 1024 / 1024} MB or smaller.`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const uploadQuery = z.object({
  alt: z.string().trim().max(255).optional(),
  status: z.enum(["APPROVED", "PENDING_REVIEW", "REJECTED"]).default("APPROVED"),
});

r.post("/products/:id/images/upload", {
  summary: "Upload a product photo (raw JPEG / PNG / WebP / AVIF body, max 8 MB)",
  description:
    "Send the file bytes as the request body with its image Content-Type. The file is saved to the storefront's public/images/products folder and attached to the product.",
  auth: "admin",
  permission: "products:write",
  query: uploadQuery,
  successStatus: 201,
}, async (req, res) => {
  const productId = id.parse(req.params.id);
  const q = uploadQuery.parse(req.query);
  const product = await db.one<{ slug: string; name: string; brandName: string }>(
    sql`SELECT p.slug, p.name, b.name AS brandName FROM products p JOIN brands b ON b.id = p.brandId WHERE p.id = ${productId}`,
  );
  if (!product) throw notFound("Product");
  const body = await readBody(req, MAX_UPLOAD_BYTES);
  const kind = IMAGE_SIGNATURES.find((s) => s.test(body));
  if (!kind) throw unprocessable("Upload a JPEG, PNG, WebP or AVIF image.", undefined, "UNSUPPORTED_IMAGE");

  const fileName = `${product.slug}-${randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, "")}.${kind.ext}`;
  const dir = path.resolve(env.WEB_PUBLIC_DIR, "images", "products");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), body);

  const next = await db.one<{ n: number | null }>(sql`SELECT MAX(sortOrder) AS n FROM product_images WHERE productId = ${productId}`);
  const imageId = await insert(db, "product_images", {
    productId,
    url: `/images/products/${fileName}`,
    alt: q.alt || `${product.brandName} ${product.name} bottle`,
    status: q.status,
    sortOrder: next?.n === null || next?.n === undefined ? 0 : next.n + 1,
    notes: "Uploaded via admin panel",
  });
  const image = (await findImage(imageId))!;
  await audit(req, "image.upload", "product_image", image.id, { productId, status: image.status, bytes: body.length });
  return created(res, image, "Image uploaded.");
});

r.delete("/images/:id", { summary: "Remove a product image record", auth: "admin", permission: "products:write" }, async (req, res) => {
  const imageId = id.parse(req.params.id);
  found((await db.run(sql`DELETE FROM product_images WHERE id = ${imageId}`)).affectedRows, "Image");
  await audit(req, "image.delete", "product_image", imageId);
  return ok(res, null, "Image removed.");
});

// Brands
const findBrand = (brandIdParam: string) => db.one<BrandRow>(sql`SELECT * FROM brands WHERE id = ${brandIdParam}`);

r.get("/brands", { summary: "All brands (incl. unpublished)", auth: "admin", permission: "products:read" }, async (_req, res) => {
  const brands = await db.many<BrandRow & { productCount: number }>(
    sql`SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brandId = b.id) AS productCount FROM brands b ORDER BY b.name ASC`,
  );
  return ok(res, brands);
});
r.post("/brands", { summary: "Create a brand", auth: "admin", permission: "brands:write", body: brandSchema, successStatus: 201 }, async (req, res) => {
  const brand = (await findBrand(await insert(db, "brands", brandSchema.parse(req.body))))!;
  await audit(req, "brand.create", "brand", brand.id, { slug: brand.slug });
  return created(res, brand, "Brand created.");
});
r.patch("/brands/:id", { summary: "Update a brand (approved description, artwork, featured)", auth: "admin", permission: "brands:write", body: brandSchema.partial() }, async (req, res) => {
  const brandIdParam = id.parse(req.params.id);
  found(await update(db, "brands", brandSchema.partial().parse(req.body), sql`id = ${brandIdParam}`), "Brand");
  const brand = (await findBrand(brandIdParam))!;
  await audit(req, "brand.update", "brand", brand.id);
  return ok(res, brand, "Brand updated.");
});
r.delete("/brands/:id", { summary: "Delete a brand without products", auth: "admin", permission: "brands:write" }, async (req, res) => {
  const brandIdParam = id.parse(req.params.id);
  if (await countWhere(sql`SELECT COUNT(*) AS n FROM products WHERE brandId = ${brandIdParam}`)) throw conflict("This brand still has products.", undefined, "BRAND_HAS_PRODUCTS");
  found((await db.run(sql`DELETE FROM brands WHERE id = ${brandIdParam}`)).affectedRows, "Brand");
  await audit(req, "brand.delete", "brand", brandIdParam);
  return ok(res, null, "Brand deleted.");
});

// Categories
const findCategory = (catId: string) => db.one<CategoryRow>(sql`SELECT * FROM categories WHERE id = ${catId}`);

r.get("/categories", { summary: "All categories", auth: "admin", permission: "products:read" }, async (_req, res) => {
  const cats = await db.many<CategoryRow & { productCount: number }>(
    sql`SELECT c.*, (SELECT COUNT(*) FROM product_categories pc WHERE pc.categoryId = c.id) AS productCount FROM categories c ORDER BY c.type ASC, c.sortOrder ASC`,
  );
  return ok(res, cats);
});
r.post("/categories", { summary: "Create a category / scent family", auth: "admin", permission: "categories:write", body: categorySchema, successStatus: 201 }, async (req, res) => {
  const cat = (await findCategory(await insert(db, "categories", categorySchema.parse(req.body))))!;
  await audit(req, "category.create", "category", cat.id, { slug: cat.slug });
  return created(res, cat, "Category created.");
});
r.patch("/categories/:id", { summary: "Update a category", auth: "admin", permission: "categories:write", body: categorySchema.partial() }, async (req, res) => {
  const catId = id.parse(req.params.id);
  found(await update(db, "categories", categorySchema.partial().parse(req.body), sql`id = ${catId}`), "Category");
  const cat = (await findCategory(catId))!;
  await audit(req, "category.update", "category", cat.id);
  return ok(res, cat, "Category updated.");
});
r.delete("/categories/:id", { summary: "Delete a category (products are unlinked)", auth: "admin", permission: "categories:write" }, async (req, res) => {
  const catId = id.parse(req.params.id);
  found((await db.run(sql`DELETE FROM categories WHERE id = ${catId}`)).affectedRows, "Category");
  await audit(req, "category.delete", "category", catId);
  return ok(res, null, "Category deleted.");
});
