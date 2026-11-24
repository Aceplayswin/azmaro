"use client";

import { createPersistentStore, useStore } from "@/lib/store/persistent-store";

export interface CartLine {
  slug: string;
  sizeMl: number;
  qty: number;
}

export const MAX_QTY = 10;

const isLine = (v: unknown): v is CartLine =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as CartLine).slug === "string" &&
  typeof (v as CartLine).sizeMl === "number" &&
  typeof (v as CartLine).qty === "number";

const cartStore = createPersistentStore<CartLine[]>("azmaro.cart.v1", [], (value) =>
  Array.isArray(value)
    ? value.filter(isLine).map((l) => ({ ...l, qty: Math.min(MAX_QTY, Math.max(1, Math.round(l.qty))) }))
    : [],
);

const sameLine = (a: Pick<CartLine, "slug" | "sizeMl">, b: Pick<CartLine, "slug" | "sizeMl">) =>
  a.slug === b.slug && a.sizeMl === b.sizeMl;

export const cartActions = {
  add(line: CartLine) {
    cartStore.set((lines) => {
      const existing = lines.find((l) => sameLine(l, line));
      if (existing) {
        return lines.map((l) => (sameLine(l, line) ? { ...l, qty: Math.min(MAX_QTY, l.qty + line.qty) } : l));
      }
      return [...lines, { ...line, qty: Math.min(MAX_QTY, line.qty) }];
    });
  },
  setQty(target: Pick<CartLine, "slug" | "sizeMl">, qty: number) {
    cartStore.set((lines) =>
      lines.map((l) => (sameLine(l, target) ? { ...l, qty: Math.min(MAX_QTY, Math.max(1, qty)) } : l)),
    );
  },
  remove(target: Pick<CartLine, "slug" | "sizeMl">) {
    cartStore.set((lines) => lines.filter((l) => !sameLine(l, target)));
  },
  clear() {
    cartStore.set(() => []);
  },
};

export function useCart() {
  const lines = useStore(cartStore);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  return { lines, count, ...cartActions };
}
