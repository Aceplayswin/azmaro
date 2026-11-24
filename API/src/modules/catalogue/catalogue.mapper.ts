import { db, sql, type Db } from "../../db";
import type { BrandRow, CategoryRow, InventoryRow, ProductImageRow, ProductRow, ProductVariantRow, StockStatus } from "../../db";
import { toAmount } from "../../utils/money";

/**
 * Product loading + DTO mappers shared by products, brands, cart, wishlist and
 * the legacy adapter. Purchasability is derived – never assumed: a variant can
 * be bought only with a confirmed price, while active, and when tracked stock
 * (if any) allows it.
 */

export type VariantRow = ProductVariantRow & { inventory: InventoryRow | null };
export type ProductCategoryLink = { productId: string; categoryId: string; category: CategoryRow };
export type ProductCardRow = ProductRow & {
  brand: BrandRow;
  variants: VariantRow[];
  images: ProductImageRow[];
  categories: ProductCategoryLink[];
};
export type ProductDetailRow = ProductCardRow;

export interface LoadProductOptions {
  /** "card": first approved image · "detail": all approved · "all": every image (admin) */
  images?: "card" | "detail" | "all";
  /** Active variants only (storefront) or every variant (admin). */
  variants?: "active" | "all";
}

const groupBy = <T, K>(rows: T[], key: (r: T) => K) => {
  const map = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
};

/** Attach each variant's inventory row (or null). */
export async function withInventory<V extends ProductVariantRow>(variants: V[], ex: Db = db): Promise<Array<V & { inventory: InventoryRow | null }>> {
  const inv = await ex.many<InventoryRow>(sql`SELECT * FROM inventory WHERE variantId IN (${variants.map((v) => v.id)})`);
  const byVariant = new Map(inv.map((i) => [i.variantId, i]));
  return variants.map((v) => ({ ...v, inventory: byVariant.get(v.id) ?? null }));
}

/** Load products with brand, variants (+inventory), images and categories – returned in `ids` order. */
export async function loadProducts(ids: string[], opts: LoadProductOptions = {}, ex: Db = db): Promise<ProductCardRow[]> {
  if (!ids.length) return [];
  const imageMode = opts.images ?? "card";
  const [products, variants, images, links] = await Promise.all([
    ex.many<ProductRow>(sql`SELECT * FROM products WHERE id IN (${ids})`),
    ex.many<ProductVariantRow>(
      opts.variants === "all"
        ? sql`SELECT * FROM product_variants WHERE productId IN (${ids}) ORDER BY sizeMl ASC`
        : sql`SELECT * FROM product_variants WHERE productId IN (${ids}) AND isActive = 1 ORDER BY sizeMl ASC`,
    ),
    ex.many<ProductImageRow>(
      imageMode === "all"
        ? sql`SELECT * FROM product_images WHERE productId IN (${ids}) ORDER BY sortOrder ASC, createdAt ASC, id ASC`
        : sql`SELECT * FROM product_images WHERE productId IN (${ids}) AND status = 'APPROVED' ORDER BY sortOrder ASC, createdAt ASC, id ASC`,
    ),
    ex.many<CategoryRow & { productId: string; categoryId: string }>(
      sql`SELECT c.*, pc.productId, pc.categoryId FROM product_categories pc JOIN categories c ON c.id = pc.categoryId WHERE pc.productId IN (${ids})`,
    ),
  ]);
  const brands = await ex.many<BrandRow>(sql`SELECT * FROM brands WHERE id IN (${[...new Set(products.map((p) => p.brandId))]})`);
  const variantsWithInv = await withInventory(variants, ex);

  const brandById = new Map(brands.map((b) => [b.id, b]));
  const variantsBy = groupBy(variantsWithInv, (v) => v.productId);
  const imagesBy = groupBy(images, (i) => i.productId);
  const linksBy = groupBy(links, (l) => l.productId);
  const byId = new Map(products.map((p) => [p.id, p]));

  return ids.flatMap((id) => {
    const p = byId.get(id);
    if (!p) return [];
    const imgs = imagesBy.get(id) ?? [];
    return [
      {
        ...p,
        brand: brandById.get(p.brandId)!,
        variants: variantsBy.get(id) ?? [],
        images: imageMode === "card" ? imgs.slice(0, 1) : imgs,
        categories: (linksBy.get(id) ?? []).map(({ productId, categoryId, ...category }) => ({
          productId,
          categoryId,
          category: { ...category, id: categoryId },
        })),
      },
    ];
  });
}

export function variantAvailability(v: Pick<VariantRow, "price" | "isActive" | "inventory">): {
  stockStatus: StockStatus | null;
  isPurchasable: boolean;
  availableQuantity: number | null;
  reason: string | null;
} {
  const inv = v.inventory;
  const tracked = inv?.quantity !== null && inv?.quantity !== undefined;
  const stockStatus: StockStatus | null =
    inv?.stockStatus ?? (tracked ? (inv!.quantity! > 0 ? "IN_STOCK" : "OUT_OF_STOCK") : null);
  let reason: string | null = null;
  if (!v.isActive) reason = "This size is no longer available.";
  else if (v.price === null) reason = "Price to be confirmed.";
  else if (stockStatus === "OUT_OF_STOCK" || (tracked && inv!.quantity! <= 0)) reason = "Out of stock.";
  return { stockStatus, isPurchasable: reason === null, availableQuantity: tracked ? inv!.quantity! : null, reason };
}

export function toVariantDto(v: VariantRow) {
  const a = variantAvailability(v);
  return {
    id: v.id,
    sizeMl: v.sizeMl,
    sku: v.sku,
    price: toAmount(v.price),
    mrp: toAmount(v.mrp),
    stockStatus: a.stockStatus,
    isPurchasable: a.isPurchasable,
    unavailableReason: a.reason,
  };
}

export function toProductCard(p: ProductCardRow) {
  const variants = p.variants.map(toVariantDto);
  const priced = variants.filter((v) => v.price !== null).sort((a, b) => a.price! - b.price!);
  const image = p.images[0];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: { id: p.brand.id, slug: p.brand.slug, name: p.brand.name },
    brandLabel: p.brandLabel,
    fragranceFamily: p.fragranceFamily,
    scentCharacter: p.scentCharacter,
    scentFamilies: p.categories
      .filter((c) => c.category.type === "SCENT_FAMILY")
      .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
      .map((c) => c.category.slug),
    noteBasis: p.noteBasis,
    gender: p.gender,
    concentration: p.concentration,
    price: priced[0]?.price ?? null,
    mrp: priced[0]?.mrp ?? null,
    priceStatus: priced.length ? ("CONFIRMED" as const) : ("TO_BE_CONFIRMED" as const),
    availableSizes: variants.map((v) => v.sizeMl),
    variants,
    isPurchasable: variants.some((v) => v.isPurchasable),
    isFeatured: p.isFeatured,
    isNew: p.isNew,
    isBestseller: p.isBestseller,
    image: image ? { url: image.url, alt: image.alt } : null,
  };
}

export function toProductDetail(p: ProductDetailRow) {
  return {
    ...toProductCard(p),
    catalogueName: p.catalogueName,
    topNotes: p.topNotes,
    heartNotes: p.heartNotes,
    baseNotes: p.baseNotes,
    /** When EDITORIAL_IMPRESSION, the notes are a scent direction – not verified ingredients. */
    notesLabel: p.noteBasis === "PUBLISHED" ? "Fragrance notes" : "Scent impression (not a verified note pyramid)",
    description: p.description,
    occasions: p.occasions,
    season: p.season,
    targetAudience: p.targetAudience,
    concentrationNote: p.concentrationNote,
    researchBasis: p.researchBasis,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
    categories: p.categories.map((c) => ({ slug: c.category.slug, name: c.category.name, type: c.category.type })),
    updatedAt: p.updatedAt,
  };
}

export type ProductCardDto = ReturnType<typeof toProductCard>;
