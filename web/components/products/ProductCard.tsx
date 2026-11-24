"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye } from "lucide-react";
import { useState } from "react";
import { ProductArtwork } from "@/components/ui/Artwork";
import { Modal } from "@/components/ui/Modal";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { QuickViewContent } from "./QuickViewContent";
import { WishlistButton } from "./WishlistButton";
import type { ProductSummary } from "@/lib/catalogue/summary";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: ProductSummary;
  priority?: boolean;
  /** Extra actions rendered under the card (e.g. wishlist "Move to bag"). */
  footer?: React.ReactNode;
  className?: string;
}

/** The single product card used across home, shop, collections, brands, search and wishlist. */
export function ProductCard({ product, priority, footer, className }: ProductCardProps) {
  const [quickOpen, setQuickOpen] = useState(false);
  const badge = product.isNew ? "New" : product.isBestseller ? "Bestseller" : null;
  const href = `/product/${product.slug}`;
  const multiSize = product.availableSizes.length > 1;

  return (
    <article className={cn("group relative flex flex-col", className)}>
      <div className="relative aspect-[4/5] overflow-hidden border border-line-soft bg-card transition-colors duration-500 group-hover:border-line">
        <Link href={href} className="absolute inset-0" tabIndex={-1} aria-hidden="true">
          <div className="relative h-full w-full transition-transform duration-[900ms] ease-[var(--az-ease)] group-hover:scale-[1.045]">
            {product.image ? (
              <Image
                src={product.image.src}
                alt={product.image.alt}
                fill
                priority={priority}
                sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, 50vw"
                className="object-cover"
              />
            ) : (
              <ProductArtwork brandName={product.brandName} name={product.name} />
            )}
          </div>
        </Link>

        {badge && (
          <span className="absolute top-3 left-3 border border-line bg-bg/80 px-2.5 py-1 text-[0.55rem] font-bold tracking-[0.2em] text-ink uppercase">
            {badge}
          </span>
        )}

        <WishlistButton slug={product.slug} name={product.name} className="absolute top-2.5 right-2.5" />

        <button
          type="button"
          onClick={() => setQuickOpen(true)}
          className="absolute inset-x-3 bottom-3 hidden translate-y-2 items-center justify-center gap-2 border border-line bg-bg/85 py-2.5 text-[0.6rem] font-bold tracking-[0.2em] text-gold-light uppercase opacity-0 backdrop-blur-sm transition-all duration-500 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-bg md:flex"
        >
          <Eye className="size-3.5" aria-hidden />
          Quick view<span className="sr-only">: {product.name}</span>
        </button>
      </div>

      <div className="mt-3.5 flex flex-1 flex-col">
        <p className="text-[0.6rem] font-bold tracking-[0.22em] text-gold uppercase">{product.brandName}</p>
        <h3 className="mt-1 font-serif text-[1.05rem] leading-snug text-ink sm:text-lg">
          <Link href={href} className="transition-colors hover:text-gold-light">
            {product.name}
          </Link>
        </h3>
        <PriceDisplay className="mt-1.5" price={product.price} mrp={product.mrp} size="sm" fromPrefix={multiSize} />
        {footer && <div className="mt-4">{footer}</div>}
      </div>

      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title={`Quick view: ${product.name}`} hideTitle>
        <QuickViewContent product={product} onNavigate={() => setQuickOpen(false)} />
      </Modal>
    </article>
  );
}

export function ProductGrid({
  products,
  className,
  priorityCount = 0,
  renderFooter,
}: {
  products: ProductSummary[];
  className?: string;
  priorityCount?: number;
  renderFooter?: (p: ProductSummary) => React.ReactNode;
}) {
  return (
    <ul className={cn("grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((p, i) => (
        <li key={p.slug}>
          <ProductCard product={p} priority={i < priorityCount} footer={renderFooter?.(p)} />
        </li>
      ))}
    </ul>
  );
}
