"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { MAX_QTY } from "@/lib/cart";
import type { ProductSummary } from "@/lib/catalogue/summary";
import { DeliveryCheck } from "./DeliveryCheck";
import { useAddToBag } from "./useAddToBag";
import { WishlistButton } from "./WishlistButton";

const STOCK_LABEL = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  preorder: "Pre-order",
} as const;

/** Size, quantity, add-to-bag, buy-now, wishlist and the mobile sticky CTA. */
export function ProductPurchasePanel({ product }: { product: ProductSummary }) {
  const router = useRouter();
  const addToBag = useAddToBag();
  const [size, setSize] = useState<number | null>(product.availableSizes[0] ?? null);
  const [qty, setQty] = useState(1);
  const variant = product.variants.find((v) => v.sizeMl === size) ?? null;
  const canBuy = variant?.price != null && variant.stockStatus !== "out_of_stock";

  const add = () => size !== null && addToBag(product, size, qty);
  const buyNow = () => {
    if (size !== null && addToBag(product, size, qty)) router.push("/checkout");
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <PriceDisplay price={variant?.price ?? product.price} mrp={variant?.mrp ?? null} size="lg" showSavings />
        {/* Stock is shown only when it comes from verified inventory data. */}
        {variant?.stockStatus && (
          <span className="border border-gold/60 px-3 py-1 text-[0.6rem] font-bold tracking-[0.2em] text-gold-light uppercase">
            {STOCK_LABEL[variant.stockStatus]}
          </span>
        )}
      </div>

      {product.availableSizes.length > 0 && (
        <fieldset className="mt-8">
          <legend className="az-field-label">Size</legend>
          <div className="flex flex-wrap gap-2.5">
            {product.availableSizes.map((s) => (
              <button
                key={s}
                type="button"
                className="az-chip min-h-11 min-w-24 justify-center"
                aria-pressed={size === s}
                onClick={() => setSize(s)}
              >
                {s} ml
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-7">
        <p className="az-field-label" id="qty-label">
          Quantity
        </p>
        <div className="flex flex-wrap items-stretch gap-3">
          <QuantitySelector value={qty} onChange={setQty} max={MAX_QTY} disabled={!canBuy} />
          <button type="button" className="az-btn az-btn-secondary min-w-36 flex-1" disabled={!canBuy} onClick={add}>
            Add to bag
          </button>
          <button type="button" className="az-btn az-btn-primary min-w-36 flex-1" disabled={!canBuy} onClick={buyNow}>
            Buy now
          </button>
          <WishlistButton slug={product.slug} name={product.name} variant="boxed" />
        </div>
        {!canBuy && (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {variant?.stockStatus === "out_of_stock"
              ? "This size is currently out of stock."
              : "Pricing for this fragrance is being confirmed, so it can't be ordered just yet. Save it to your wishlist and we'll keep it for you."}
          </p>
        )}
      </div>

      <div className="mt-8">
        <DeliveryCheck />
      </div>

      {/* Mobile sticky purchase bar */}
      <div className="az-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-4 pt-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.65rem] tracking-[0.12em] text-ink-2 uppercase">
              {product.name}
              {size ? ` · ${size} ml` : ""}
            </p>
            <PriceDisplay price={variant?.price ?? product.price} mrp={variant?.mrp ?? null} size="sm" />
          </div>
          <button type="button" className="az-btn az-btn-primary shrink-0 px-6" disabled={!canBuy} onClick={add}>
            {canBuy ? "Add to bag" : "Coming soon"}
          </button>
        </div>
      </div>
    </>
  );
}
