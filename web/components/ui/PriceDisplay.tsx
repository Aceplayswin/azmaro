import { cn, formatPrice } from "@/lib/utils";

/**
 * Discount off the MRP as a whole percentage, rounded DOWN so the label never
 * overstates the saving (₹580 vs ₹730 = 20.5% → "20% OFF"). Null when there is no real discount.
 */
export function discountPercent(price: number | null | undefined, mrp: number | null | undefined): number | null {
  if (typeof price !== "number" || typeof mrp !== "number" || mrp <= price || mrp <= 0) return null;
  const pct = Math.floor(((mrp - price) / mrp) * 100);
  return pct >= 1 ? pct : null;
}

/** "20% OFF" label. */
export function DiscountBadge({ price, mrp, className }: { price: number | null | undefined; mrp: number | null | undefined; className?: string }) {
  const pct = discountPercent(price, mrp);
  if (pct === null) return null;
  return <span className={cn("text-xs font-bold tracking-[0.04em] text-success tabular-nums", className)}>{pct}% OFF</span>;
}

/**
 * Shows a verified price, or an honest "to be confirmed" state.
 * MRP and the % OFF label are shown only when the MRP is real and higher than the selling price.
 */
export function PriceDisplay({
  price,
  mrp,
  size = "md",
  fromPrefix,
  showSavings,
  className,
}: {
  price: number | null;
  mrp?: number | null;
  size?: "sm" | "md" | "lg";
  fromPrefix?: boolean;
  /** Also show "You save ₹X" (product page). */
  showSavings?: boolean;
  className?: string;
}) {
  if (price === null) {
    return (
      <p className={cn("text-[0.7rem] font-semibold tracking-[0.14em] text-muted uppercase", className)}>
        Price to be confirmed
      </p>
    );
  }
  const showMrp = typeof mrp === "number" && mrp > price;
  return (
    <div className={className}>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={cn(
            "font-bold tracking-[0.06em] text-ink tabular-nums",
            size === "sm" && "text-[0.8rem]",
            size === "md" && "text-sm",
            size === "lg" && "text-2xl sm:text-[1.75rem]",
          )}
        >
          {fromPrefix && <span className="mr-1 text-[0.7em] font-semibold text-ink-2">From</span>}
          {formatPrice(price)}
        </span>
        {showMrp && (
          <>
            <span className="text-xs text-muted tabular-nums">
              <span className="sr-only">MRP </span>
              <s>{formatPrice(mrp)}</s>
            </span>
            <DiscountBadge price={price} mrp={mrp} className={size === "lg" ? "text-sm" : undefined} />
          </>
        )}
      </p>
      {showMrp && showSavings && (
        <p className="mt-1 text-xs text-success">
          You save {formatPrice(mrp - price)} on MRP
        </p>
      )}
    </div>
  );
}
