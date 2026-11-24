"use client";

import { createPersistentStore, useStore } from "@/lib/store/persistent-store";

/**
 * Guest wishlist, persisted locally. The shape (array of slugs + timestamps)
 * is deliberately simple so it can be synced to an account later.
 */
export interface WishlistItem {
  slug: string;
  addedAt: string;
}

const wishlistStore = createPersistentStore<WishlistItem[]>("azmaro.wishlist.v1", [], (value) =>
  Array.isArray(value)
    ? value.filter(
        (v): v is WishlistItem =>
          typeof v === "object" && v !== null && typeof (v as WishlistItem).slug === "string",
      )
    : [],
);

export const wishlistActions = {
  toggle(slug: string): boolean {
    let added = false;
    wishlistStore.set((items) => {
      if (items.some((i) => i.slug === slug)) return items.filter((i) => i.slug !== slug);
      added = true;
      return [{ slug, addedAt: new Date().toISOString() }, ...items];
    });
    return added;
  },
  add(slug: string) {
    wishlistStore.set((items) =>
      items.some((i) => i.slug === slug) ? items : [{ slug, addedAt: new Date().toISOString() }, ...items],
    );
  },
  remove(slug: string) {
    wishlistStore.set((items) => items.filter((i) => i.slug !== slug));
  },
  clear() {
    wishlistStore.set(() => []);
  },
};

export function useWishlist() {
  const items = useStore(wishlistStore);
  const has = (slug: string) => items.some((i) => i.slug === slug);
  return { items, count: items.length, has, ...wishlistActions };
}
