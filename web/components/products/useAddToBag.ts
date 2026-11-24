"use client";

import { useCallback } from "react";
import { cartActions } from "@/lib/cart";
import { toast } from "@/lib/toast";
import type { ProductSummary } from "@/lib/catalogue/summary";

/** Adds a verified, priced variant to the bag and confirms with a toast. */
export function useAddToBag() {
  return useCallback((product: Pick<ProductSummary, "slug" | "name" | "variants">, sizeMl: number, qty: number) => {
    const variant = product.variants.find((v) => v.sizeMl === sizeMl);
    if (!variant || variant.price === null || variant.stockStatus === "out_of_stock") {
      toast({ title: "This size isn't available to order yet.", tone: "error" });
      return false;
    }
    cartActions.add({ slug: product.slug, sizeMl, qty });
    toast({
      title: `${product.name} added to your bag`,
      description: `${sizeMl} ml × ${qty}`,
      action: { label: "View bag", href: "/bag" },
    });
    return true;
  }, []);
}
