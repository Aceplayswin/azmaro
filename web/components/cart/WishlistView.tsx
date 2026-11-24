"use client";

import { useMemo } from "react";
import { ProductGrid } from "@/components/products/ProductCard";
import { useAddToBag } from "@/components/products/useAddToBag";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/States";
import type { ProductSummary } from "@/lib/catalogue/summary";
import { useHydrated } from "@/lib/store/persistent-store";
import { toast } from "@/lib/toast";
import { pluralise } from "@/lib/utils";
import { useWishlist } from "@/lib/wishlist";

export function WishlistView({ products }: { products: ProductSummary[] }) {
  const hydrated = useHydrated();
  const { items, remove } = useWishlist();
  const addToBag = useAddToBag();
  const saved = useMemo(() => {
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    return items.map((i) => bySlug.get(i.slug)).filter((p): p is ProductSummary => Boolean(p));
  }, [items, products]);

  const firstBuyableSize = (p: ProductSummary) =>
    p.variants.find((v) => v.price !== null && v.stockStatus !== "out_of_stock")?.sizeMl ?? null;

  const moveToBag = (p: ProductSummary) => {
    const size = firstBuyableSize(p);
    if (size !== null && addToBag(p, size, 1)) remove(p.slug);
  };

  const moveAll = () => {
    const buyable = saved.filter((p) => firstBuyableSize(p) !== null);
    buyable.forEach((p) => moveToBag(p));
    const skipped = saved.length - buyable.length;
    if (skipped > 0) {
      toast({
        title: `${pluralise(skipped, "fragrance")} kept in your wishlist`,
        description: "Pricing for these is still being confirmed.",
      });
    }
  };

  if (!hydrated) return <LoadingState label="Loading your wishlist" />;

  if (!saved.length) {
    return (
      <EmptyState title="Your wishlist is empty" description="Tap the heart on any fragrance to save it here for later.">
        <ButtonLink href="/shop">Explore fragrances</ButtonLink>
        <ButtonLink href="/brands" variant="secondary">
          Browse brands
        </ButtonLink>
      </EmptyState>
    );
  }

  const anyBuyable = saved.some((p) => firstBuyableSize(p) !== null);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-2">{pluralise(saved.length, "saved fragrance")}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/shop" variant="ghost" size="sm">
            Continue shopping
          </ButtonLink>
          <button type="button" className="az-btn az-btn-secondary az-btn-sm" onClick={moveAll} disabled={!anyBuyable}>
            Move all to bag
          </button>
        </div>
      </div>
      <ProductGrid
        products={saved}
        renderFooter={(p) => {
          const buyable = firstBuyableSize(p) !== null;
          return (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="az-btn az-btn-secondary az-btn-sm flex-1 px-3"
                disabled={!buyable}
                onClick={() => moveToBag(p)}
                title={buyable ? undefined : "Price to be confirmed"}
              >
                {buyable ? "Move to bag" : "Coming soon"}
              </button>
              <button
                type="button"
                className="text-[0.6rem] font-bold tracking-[0.18em] text-muted uppercase transition-colors hover:text-danger"
                onClick={() => remove(p.slug)}
              >
                Remove<span className="sr-only"> {p.name}</span>
              </button>
            </div>
          );
        }}
      />
    </>
  );
}
