"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ProductArtwork } from "@/components/ui/Artwork";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { WishlistButton } from "./WishlistButton";
import { useAddToBag } from "./useAddToBag";
import type { ProductSummary } from "@/lib/catalogue/summary";
import { CONCENTRATION_LABELS } from "@/lib/catalogue/filter";
import { cn } from "@/lib/utils";

/** Quick view body – used inside a Modal from product cards and inline in search. */
export function QuickViewContent({ product, onNavigate }: { product: ProductSummary; onNavigate?: () => void }) {
  const [size, setSize] = useState<number | null>(product.availableSizes[0] ?? null);
  const variant = product.variants.find((v) => v.sizeMl === size) ?? null;
  const addToBag = useAddToBag();
  const canBuy = variant?.price != null && variant.stockStatus !== "out_of_stock";

  return (
    <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-8 sm:p-7">
      <div className="relative aspect-[4/5] overflow-hidden border border-line-soft">
        {product.image ? (
          <Image src={product.image.src} alt={product.image.alt} fill sizes="240px" className="object-cover" />
        ) : (
          <ProductArtwork brandName={product.brandName} name={product.name} />
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <p className="az-eyebrow">{product.brandLabel}</p>
        <h3 className="mt-2 font-serif text-3xl leading-tight">{product.name}</h3>
        {product.concentration && (
          <p className="mt-2 text-xs tracking-[0.14em] text-ink-2 uppercase">{CONCENTRATION_LABELS[product.concentration]}</p>
        )}
        <PriceDisplay className="mt-4" price={variant?.price ?? product.price} mrp={variant?.mrp ?? product.mrp} size="md" />
        <p className="mt-4 line-clamp-3 text-sm text-ink-2">{product.scentCharacter}</p>

        {product.availableSizes.length > 0 && (
          <fieldset className="mt-5">
            <legend className="az-field-label">Size</legend>
            <div className="flex flex-wrap gap-2">
              {product.availableSizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="az-chip"
                  aria-pressed={size === s}
                  onClick={() => setSize(s)}
                >
                  {s} ml
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-auto flex flex-wrap gap-3 pt-6">
          <Link href={`/product/${product.slug}`} onClick={onNavigate} className="az-btn az-btn-secondary flex-1">
            View product
          </Link>
          <button
            type="button"
            className={cn("az-btn az-btn-primary flex-1")}
            disabled={!canBuy}
            onClick={() => size && addToBag(product, size, 1)}
          >
            {canBuy ? "Add to bag" : "Not yet available"}
          </button>
          <WishlistButton slug={product.slug} name={product.name} variant="boxed" />
        </div>
        {!canBuy && (
          <p className="mt-3 text-xs text-muted">Pricing for this fragrance is being confirmed. Save it to your wishlist meanwhile.</p>
        )}
      </div>
    </div>
  );
}
