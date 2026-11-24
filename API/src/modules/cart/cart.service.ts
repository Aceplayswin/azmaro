import type { Request, Response } from "express";
import { getShippingProvider } from "../../integrations/shipping";
import { db, insert, newId, sql, transaction, update, type CartItemRow, type CartRow, type Db, type ProductVariantRow } from "../../db";
import { randomToken, sha256 } from "../../utils/crypto";
import { conflict, notFound, unprocessable } from "../../utils/errors";
import { COOKIES, clearGuestCookie, setGuestCookie } from "../auth/tokens";
import { variantAvailability } from "../catalogue/catalogue.mapper";
import { buildQuote, loadQuoteVariants, quoteLineDto, quoteTotalsDto, quoteVariantsByIds, type QuoteVariant } from "../checkout/quote.service";
import { getSetting } from "../settings/settings.service";

/**
 * Carts for guests (opaque cookie token – only its SHA-256 is stored) and
 * signed-in customers (one cart per user). Guest carts are merged into the
 * customer's cart on sign-in.
 */

export interface CartOwner {
  userId?: string;
  guestTokenHash?: string;
}

/** Resolve the cart owner from the request; optionally mint a guest token cookie. */
export function cartOwner(req: Request, res: Response, create: boolean): CartOwner | null {
  if (req.auth) return { userId: req.auth.userId };
  const token = (req.cookies as Record<string, string | undefined>)?.[COOKIES.cart];
  if (token && token.length >= 20) return { guestTokenHash: sha256(token) };
  if (!create) return null;
  const fresh = randomToken(32);
  setGuestCookie(res, COOKIES.cart, fresh);
  return { guestTokenHash: sha256(fresh) };
}

const ownerCondition = (o: CartOwner) => (o.userId ? sql`userId = ${o.userId}` : sql`guestTokenHash = ${o.guestTokenHash!}`);

export type CartWithItems = CartRow & { items: Array<CartItemRow & { variant: QuoteVariant }> };

async function withItems(cart: CartRow | null): Promise<CartWithItems | null> {
  if (!cart) return null;
  const items = await db.many<CartItemRow>(sql`SELECT * FROM cart_items WHERE cartId = ${cart.id} ORDER BY createdAt ASC, id ASC`);
  const variants = new Map((await quoteVariantsByIds(items.map((i) => i.variantId))).map((v) => [v.id, v]));
  return { ...cart, items: items.map((i) => ({ ...i, variant: variants.get(i.variantId)! })) };
}

export async function findCart(owner: CartOwner) {
  return withItems(await db.one<CartRow>(sql`SELECT * FROM carts WHERE ${ownerCondition(owner)}`));
}

export async function getOrCreateCart(owner: CartOwner): Promise<CartWithItems> {
  const existing = await findCart(owner);
  if (existing) return existing;
  await insert(db, "carts", {
    ...(owner.userId ? { userId: owner.userId } : { guestTokenHash: owner.guestTokenHash }),
    expiresAt: owner.userId ? null : new Date(Date.now() + 60 * 86_400_000),
  });
  return (await findCart(owner))!;
}

/** Insert a cart line or set its quantity if the variant is already in the cart. */
async function upsertItem(ex: Db, cartId: string, variantId: string, quantity: number) {
  await ex.run(sql`
    INSERT INTO cart_items (id, cartId, variantId, quantity) VALUES (${newId()}, ${cartId}, ${variantId}, ${quantity}) AS incoming
    ON DUPLICATE KEY UPDATE quantity = incoming.quantity`);
}

export async function cartDto(cart: CartWithItems | null, email?: string | null) {
  if (!cart) {
    const empty = await buildQuote({ lines: [] });
    return { id: null, items: [], itemCount: 0, couponCode: null, coupon: null, deliveryPin: null, totals: quoteTotalsDto(empty), hasUnavailableItems: false };
  }
  const quote = await buildQuote({
    lines: cart.items.map((i) => ({ variant: i.variant, quantity: i.quantity })),
    couponCode: cart.couponCode,
    email,
  });
  return {
    id: cart.id,
    items: quote.lines.map(quoteLineDto),
    itemCount: cart.items.reduce((s, i) => s + i.quantity, 0),
    couponCode: cart.couponCode,
    coupon: quote.coupon
      ? { code: quote.coupon.code, valid: quote.coupon.valid, message: quote.coupon.message }
      : null,
    deliveryPin: cart.deliveryPin,
    totals: quoteTotalsDto(quote),
    hasUnavailableItems: quote.hasUnavailableItems,
  };
}

async function resolveVariant(input: { variantId?: string; productSlug?: string; sizeMl?: number }) {
  const row = input.variantId
    ? await db.one<ProductVariantRow>(sql`SELECT * FROM product_variants WHERE id = ${input.variantId}`)
    : await db.one<ProductVariantRow>(
        sql`SELECT v.* FROM product_variants v JOIN products p ON p.id = v.productId WHERE v.sizeMl = ${input.sizeMl ?? null} AND p.slug = ${input.productSlug ?? null} LIMIT 1`,
      );
  const [variant] = row ? await loadQuoteVariants([row]) : [];
  if (!variant || !variant.product.isPublished) throw notFound("Product variant");
  return variant;
}

export async function addItem(owner: CartOwner, input: { variantId?: string; productSlug?: string; sizeMl?: number; quantity: number }) {
  const variant = await resolveVariant(input);
  const availability = variantAvailability(variant);
  if (!availability.isPurchasable) throw conflict(availability.reason ?? "This item can't be ordered.", { variantId: variant.id }, "NOT_PURCHASABLE");
  const { maxQuantityPerLine } = await getSetting("orders");
  const cart = await getOrCreateCart(owner);
  const existing = cart.items.find((i) => i.variantId === variant.id);
  const quantity = Math.min(maxQuantityPerLine, (existing?.quantity ?? 0) + input.quantity);
  if (availability.availableQuantity !== null && quantity > availability.availableQuantity) {
    throw conflict(`Only ${availability.availableQuantity} left in stock.`, { available: availability.availableQuantity }, "INSUFFICIENT_STOCK");
  }
  await upsertItem(db, cart.id, variant.id, quantity);
  return findCart(owner);
}

export async function updateItem(owner: CartOwner, variantId: string, quantity: number) {
  const cart = await findCart(owner);
  const item = cart?.items.find((i) => i.variantId === variantId);
  if (!cart || !item) throw notFound("Cart item");
  const { maxQuantityPerLine } = await getSetting("orders");
  if (quantity > maxQuantityPerLine) throw unprocessable(`You can order up to ${maxQuantityPerLine} of each item.`);
  const availability = variantAvailability(item.variant);
  if (availability.availableQuantity !== null && quantity > availability.availableQuantity) {
    throw conflict(`Only ${availability.availableQuantity} left in stock.`, { available: availability.availableQuantity }, "INSUFFICIENT_STOCK");
  }
  await update(db, "cart_items", { quantity }, sql`id = ${item.id}`);
  return findCart(owner);
}

export async function removeItem(owner: CartOwner, variantId: string) {
  const cart = await findCart(owner);
  if (!cart) throw notFound("Cart item");
  const { affectedRows } = await db.run(sql`DELETE FROM cart_items WHERE cartId = ${cart.id} AND variantId = ${variantId}`);
  if (!affectedRows) throw notFound("Cart item");
  return findCart(owner);
}

export async function clearCart(owner: CartOwner) {
  const cart = await findCart(owner);
  if (cart)
    await transaction(async (tx) => {
      await tx.run(sql`DELETE FROM cart_items WHERE cartId = ${cart.id}`);
      await update(tx, "carts", { couponCode: null }, sql`id = ${cart.id}`);
    });
  return findCart(owner);
}

export async function applyCoupon(owner: CartOwner, code: string, email?: string | null) {
  const cart = await getOrCreateCart(owner);
  const quote = await buildQuote({ lines: cart.items.map((i) => ({ variant: i.variant, quantity: i.quantity })), couponCode: code, email });
  if (!quote.coupon?.valid) throw unprocessable(quote.coupon?.message ?? "This code isn't valid.", undefined, "COUPON_INVALID");
  await update(db, "carts", { couponCode: quote.coupon.code }, sql`id = ${cart.id}`);
  return findCart(owner);
}

export async function removeCoupon(owner: CartOwner) {
  const cart = await findCart(owner);
  if (cart) await update(db, "carts", { couponCode: null }, sql`id = ${cart.id}`);
  return findCart(owner);
}

export async function setDeliveryPin(owner: CartOwner, pin: string) {
  const cart = await getOrCreateCart(owner);
  await update(db, "carts", { deliveryPin: pin }, sql`id = ${cart.id}`);
  const { defaultWeightGrams } = await getSetting("shipping");
  const serviceability = await getShippingProvider().checkServiceability(pin, { cod: false, weightGrams: defaultWeightGrams });
  return { cart: await findCart(owner), serviceability };
}

/** Merge a guest cart into the signed-in customer's cart (quantities summed, capped). */
export async function mergeGuestCart(req: Request, res: Response, userId: string) {
  const token = (req.cookies as Record<string, string | undefined>)?.[COOKIES.cart];
  if (!token) return;
  clearGuestCookie(res, COOKIES.cart);
  const guest = await db.one<CartRow>(sql`SELECT * FROM carts WHERE guestTokenHash = ${sha256(token)}`);
  if (!guest) return;
  const guestItems = await db.many<CartItemRow>(sql`SELECT * FROM cart_items WHERE cartId = ${guest.id} ORDER BY createdAt ASC, id ASC`);
  const { maxQuantityPerLine } = await getSetting("orders");
  const userCart = await getOrCreateCart({ userId });
  await transaction(async (tx) => {
    for (const item of guestItems) {
      const existing = userCart.items.find((i) => i.variantId === item.variantId);
      const quantity = Math.min(maxQuantityPerLine, item.quantity + (existing?.quantity ?? 0));
      await upsertItem(tx, userCart.id, item.variantId, quantity);
    }
    if (guest.couponCode && !userCart.couponCode) await update(tx, "carts", { couponCode: guest.couponCode }, sql`id = ${userCart.id}`);
    await tx.run(sql`DELETE FROM carts WHERE id = ${guest.id}`);
  });
}

/**
 * Make the server cart match the shopper's bag exactly (the storefront keeps the
 * bag in the browser and mirrors it here so admins can see cart activity).
 * Quantities are capped; an empty list empties the cart.
 */
export async function replaceItems(owner: CartOwner, lines: Array<{ variantId: string; quantity: number }>) {
  const { maxQuantityPerLine } = await getSetting("orders");
  const existing = await db.one<CartRow>(sql`SELECT * FROM carts WHERE ${ownerCondition(owner)}`);
  if (!existing && !lines.length) return;
  const cart = existing ?? (await getOrCreateCart(owner));
  await transaction(async (tx) => {
    // (An empty NOT IN list would be "NOT IN (NULL)", which matches nothing – so empty the cart explicitly.)
    if (lines.length) await tx.run(sql`DELETE FROM cart_items WHERE cartId = ${cart.id} AND variantId NOT IN (${lines.map((l) => l.variantId)})`);
    else await tx.run(sql`DELETE FROM cart_items WHERE cartId = ${cart.id}`);
    for (const l of lines) await upsertItem(tx, cart.id, l.variantId, Math.min(maxQuantityPerLine, Math.max(1, l.quantity)));
    if (!lines.length) await update(tx, "carts", { couponCode: null }, sql`id = ${cart.id}`);
  });
}
