import { db, sql, type BrandRow, type CouponRow, type Db, type InventoryRow, type ProductImageRow, type ProductRow, type ProductVariantRow } from "../../db";
import { Decimal, money, round2, sum, toAmount } from "../../utils/money";
import { variantAvailability, withInventory } from "../catalogue/catalogue.mapper";
import { getSetting } from "../settings/settings.service";

/**
 * Order quote – the single source of truth for bag, checkout and order totals:
 *   subtotal − discount + delivery = total payable   (no tax row, by design)
 * All arithmetic is decimal. Delivery is null ("to be confirmed") unless
 * AZMARO has configured a delivery charge.
 */

/** A variant with its stock, product, brand and first approved image. */
export type QuoteVariant = ProductVariantRow & {
  inventory: InventoryRow | null;
  product: ProductRow & { brand: BrandRow; images: ProductImageRow[] };
};

/** Attach stock, product, brand and first approved image to variant rows (for pricing). */
export async function loadQuoteVariants(variants: ProductVariantRow[], ex: Db = db): Promise<QuoteVariant[]> {
  if (!variants.length) return [];
  const productIds = [...new Set(variants.map((v) => v.productId))];
  const [withInv, products, images] = await Promise.all([
    withInventory(variants, ex),
    ex.many<ProductRow>(sql`SELECT * FROM products WHERE id IN (${productIds})`),
    ex.many<ProductImageRow>(sql`SELECT * FROM product_images WHERE productId IN (${productIds}) AND status = 'APPROVED' ORDER BY sortOrder ASC, createdAt ASC, id ASC`),
  ]);
  const brands = await ex.many<BrandRow>(sql`SELECT * FROM brands WHERE id IN (${[...new Set(products.map((p) => p.brandId))]})`);
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const productById = new Map(
    products.map((p) => [p.id, { ...p, brand: brandById.get(p.brandId)!, images: images.filter((i) => i.productId === p.id).slice(0, 1) }]),
  );
  return withInv.map((v) => ({ ...v, product: productById.get(v.productId)! }));
}

export async function quoteVariantsByIds(ids: string[], ex: Db = db) {
  return loadQuoteVariants(await ex.many<ProductVariantRow>(sql`SELECT * FROM product_variants WHERE id IN (${ids})`), ex);
}

export interface QuoteLineInput {
  variant: QuoteVariant;
  quantity: number;
}

export interface CouponEvaluation {
  code: string;
  valid: boolean;
  discount: Decimal;
  message: string;
  couponId: string | null;
}

/** Validate a coupon for a subtotal (and optionally a customer email for per-customer limits). */
export async function evaluateCoupon(
  rawCode: string,
  subtotal: Decimal,
  email?: string | null,
  ex: Db = db,
): Promise<CouponEvaluation> {
  const code = rawCode.trim().toUpperCase();
  const invalid = (message: string): CouponEvaluation => ({ code, valid: false, discount: new Decimal(0), message, couponId: null });
  const coupon = await ex.one<CouponRow>(sql`SELECT * FROM coupons WHERE code = ${code}`);
  const now = new Date();
  if (!coupon || !coupon.isActive) return invalid("This code isn't valid.");
  if (coupon.startsAt && coupon.startsAt > now) return invalid("This code isn't active yet.");
  if (coupon.endsAt && coupon.endsAt < now) return invalid("This code has expired.");
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return invalid("This code has reached its usage limit.");
  if (coupon.minSubtotal && subtotal.lessThan(money(coupon.minSubtotal)))
    return invalid(`This code applies to orders of ₹${toAmount(coupon.minSubtotal)} or more.`);
  if (email && coupon.perUserLimit !== null) {
    const used = (await ex.one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM coupon_redemptions WHERE couponId = ${coupon.id} AND email = ${email.toLowerCase()}`))!.n;
    if (used >= coupon.perUserLimit) return invalid("You have already used this code.");
  }
  let discount =
    coupon.type === "PERCENT" ? round2(subtotal.times(money(coupon.value)).dividedBy(100)) : money(coupon.value);
  if (coupon.maxDiscount) discount = Decimal.min(discount, money(coupon.maxDiscount));
  discount = Decimal.min(discount, subtotal);
  return {
    code,
    valid: true,
    discount,
    couponId: coupon.id,
    message: coupon.type === "PERCENT" ? `${money(coupon.value).toString()}% off applied.` : `₹${toAmount(coupon.value)} off applied.`,
  };
}

export async function deliveryFeeFor(subtotal: Decimal): Promise<{ fee: Decimal | null; status: "CONFIGURED" | "FREE" | "TO_BE_CONFIRMED" }> {
  const s = await getSetting("shipping");
  if (s.freeAboveInr !== null && subtotal.greaterThanOrEqualTo(s.freeAboveInr) && subtotal.greaterThan(0))
    return { fee: new Decimal(0), status: "FREE" };
  if (s.flatFeeInr === null) return { fee: null, status: "TO_BE_CONFIRMED" };
  return { fee: money(s.flatFeeInr), status: s.flatFeeInr === 0 ? "FREE" : "CONFIGURED" };
}

export function quoteLineDto(line: QuoteLineInput) {
  const v = line.variant;
  const availability = variantAvailability(v);
  const unit = v.price === null ? null : money(v.price);
  return {
    variantId: v.id,
    productId: v.productId,
    slug: v.product.slug,
    name: v.product.name,
    brandName: v.product.brand.name,
    sizeMl: v.sizeMl,
    sku: v.sku,
    concentration: v.product.concentration,
    image: v.product.images[0] ? { url: v.product.images[0].url, alt: v.product.images[0].alt } : null,
    quantity: line.quantity,
    unitPrice: toAmount(unit),
    lineTotal: unit === null ? null : toAmount(unit.times(line.quantity)),
    isPurchasable: availability.isPurchasable,
    unavailableReason: availability.reason,
    availableQuantity: availability.availableQuantity,
  };
}

export async function buildQuote(input: { lines: QuoteLineInput[]; couponCode?: string | null; email?: string | null }) {
  const purchasable = input.lines.filter((l) => variantAvailability(l.variant).isPurchasable);
  const subtotal = round2(sum(purchasable.map((l) => money(l.variant.price).times(l.quantity))));
  const coupon = input.couponCode ? await evaluateCoupon(input.couponCode, subtotal, input.email) : null;
  const discount = coupon?.valid ? coupon.discount : new Decimal(0);
  const delivery = await deliveryFeeFor(subtotal.minus(discount));
  const total = round2(subtotal.minus(discount).plus(delivery.fee ?? 0));
  return {
    lines: input.lines,
    purchasableLines: purchasable,
    subtotal,
    discount,
    delivery: delivery.fee,
    deliveryStatus: delivery.status,
    total,
    coupon,
    hasUnavailableItems: purchasable.length !== input.lines.length,
  };
}

export type Quote = Awaited<ReturnType<typeof buildQuote>>;

export function quoteTotalsDto(q: Quote) {
  return {
    subtotal: toAmount(q.subtotal)!,
    discount: toAmount(q.discount)!,
    delivery: toAmount(q.delivery),
    deliveryStatus: q.deliveryStatus,
    total: toAmount(q.total)!,
    currency: "INR" as const,
    /** Explicitly no tax line in the displayed summary (per AZMARO requirements). */
    note: q.delivery === null ? "Delivery charges, if any, are confirmed with you before dispatch and are not included in this total." : null,
  };
}
