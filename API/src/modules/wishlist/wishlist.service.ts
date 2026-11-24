import type { Request, Response } from "express";
import { db, newId, sql, transaction, type Db, type WishlistItemRow, type WishlistRow } from "../../db";
import { randomToken, sha256 } from "../../utils/crypto";
import { conflict, notFound } from "../../utils/errors";
import { COOKIES, clearGuestCookie, setGuestCookie } from "../auth/tokens";
import { loadProducts, toProductCard, variantAvailability, type ProductCardRow } from "../catalogue/catalogue.mapper";
import { findProductIds, publicProductWhere } from "../catalogue/products.service";
import * as cartService from "../cart/cart.service";

export interface WishlistOwner {
  userId?: string;
  guestTokenHash?: string;
}

export function wishlistOwner(req: Request, res: Response, create: boolean): WishlistOwner | null {
  if (req.auth) return { userId: req.auth.userId };
  const token = (req.cookies as Record<string, string | undefined>)?.[COOKIES.wishlist];
  if (token && token.length >= 20) return { guestTokenHash: sha256(token) };
  if (!create) return null;
  const fresh = randomToken(32);
  setGuestCookie(res, COOKIES.wishlist, fresh);
  return { guestTokenHash: sha256(fresh) };
}

const ownerCondition = (o: WishlistOwner) => (o.userId ? sql`userId = ${o.userId}` : sql`guestTokenHash = ${o.guestTokenHash!}`);

export type WishlistWithItems = WishlistRow & { items: Array<WishlistItemRow & { product: ProductCardRow }> };

/** Wishlist with its publicly visible products, most recently added first. */
export async function findWishlist(o: WishlistOwner): Promise<WishlistWithItems | null> {
  const w = await db.one<WishlistRow>(sql`SELECT * FROM wishlists WHERE ${ownerCondition(o)}`);
  if (!w) return null;
  const items = await db.many<WishlistItemRow>(sql`
    SELECT wi.* FROM wishlist_items wi JOIN products p ON p.id = wi.productId JOIN brands b ON b.id = p.brandId
    WHERE wi.wishlistId = ${w.id} AND ${publicProductWhere}
    ORDER BY wi.createdAt DESC, wi.id DESC`);
  const products = new Map((await loadProducts(items.map((i) => i.productId))).map((p) => [p.id, p]));
  return { ...w, items: items.map((i) => ({ ...i, product: products.get(i.productId)! })) };
}

async function getOrCreate(o: WishlistOwner) {
  const existing = await findWishlist(o);
  if (existing) return existing;
  await db.run(sql`INSERT INTO wishlists (id, userId, guestTokenHash) VALUES (${newId()}, ${o.userId ?? null}, ${o.userId ? null : o.guestTokenHash!})`);
  return (await findWishlist(o))!;
}

/** Add a product (no-op when it is already on the list). */
const addItem = (ex: Db, wishlistId: string, productId: string) =>
  ex.run(sql`INSERT IGNORE INTO wishlist_items (id, wishlistId, productId) VALUES (${newId()}, ${wishlistId}, ${productId})`);

const deleteItem = (id: string) => db.run(sql`DELETE FROM wishlist_items WHERE id = ${id}`);

export function wishlistDto(w: WishlistWithItems | null) {
  const items = (w?.items ?? []).map((i) => ({ addedAt: i.createdAt, product: toProductCard(i.product) }));
  return { id: w?.id ?? null, count: items.length, items };
}

export async function addProduct(o: WishlistOwner, productSlug: string) {
  const [productId] = await findProductIds(sql`p.slug = ${productSlug} AND ${publicProductWhere}`);
  if (!productId) throw notFound("Product");
  const w = await getOrCreate(o);
  await addItem(db, w.id, productId);
  return findWishlist(o);
}

export async function removeProduct(o: WishlistOwner, productSlug: string) {
  const w = await findWishlist(o);
  const item = w?.items.find((i) => i.product.slug === productSlug);
  if (!w || !item) throw notFound("Wishlist item");
  await deleteItem(item.id);
  return findWishlist(o);
}

/** Move one product to the cart (chosen size, or the smallest purchasable size). */
export async function moveToCart(req: Request, res: Response, o: WishlistOwner, productSlug: string, sizeMl?: number) {
  const w = await findWishlist(o);
  const item = w?.items.find((i) => i.product.slug === productSlug);
  if (!w || !item) throw notFound("Wishlist item");
  const variant = item.product.variants
    .filter((v) => (sizeMl ? v.sizeMl === sizeMl : true))
    .find((v) => variantAvailability(v).isPurchasable);
  if (!variant) throw conflict("This fragrance can't be ordered yet (price to be confirmed or out of stock).", { slug: productSlug }, "NOT_PURCHASABLE");
  await cartService.addItem(cartService.cartOwner(req, res, true)!, { variantId: variant.id, quantity: 1 });
  await deleteItem(item.id);
  return findWishlist(o);
}

/** Move every purchasable product to the cart; report the ones that can't be moved. */
export async function moveAllToCart(req: Request, res: Response, o: WishlistOwner) {
  const w = await findWishlist(o);
  const moved: string[] = [];
  const skipped: Array<{ slug: string; reason: string }> = [];
  const owner = cartService.cartOwner(req, res, true)!;
  for (const item of w?.items ?? []) {
    const variant = item.product.variants.find((v) => variantAvailability(v).isPurchasable);
    if (!variant) {
      skipped.push({ slug: item.product.slug, reason: "Price to be confirmed or out of stock." });
      continue;
    }
    try {
      await cartService.addItem(owner, { variantId: variant.id, quantity: 1 });
      await deleteItem(item.id);
      moved.push(item.product.slug);
    } catch (e) {
      skipped.push({ slug: item.product.slug, reason: e instanceof Error ? e.message : "Could not be added." });
    }
  }
  return { wishlist: await findWishlist(o), moved, skipped };
}

export async function mergeGuestWishlist(req: Request, res: Response, userId: string) {
  const token = (req.cookies as Record<string, string | undefined>)?.[COOKIES.wishlist];
  if (!token) return;
  clearGuestCookie(res, COOKIES.wishlist);
  const guest = await db.one<WishlistRow>(sql`SELECT * FROM wishlists WHERE guestTokenHash = ${sha256(token)}`);
  if (!guest) return;
  const guestItems = await db.many<WishlistItemRow>(sql`SELECT * FROM wishlist_items WHERE wishlistId = ${guest.id}`);
  const mine = await getOrCreate({ userId });
  await transaction(async (tx) => {
    for (const i of guestItems) await addItem(tx, mine.id, i.productId);
    await tx.run(sql`DELETE FROM wishlists WHERE id = ${guest.id}`);
  });
}
