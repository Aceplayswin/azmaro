import type { OrderTotals } from "@/lib/cart/pricing";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Price breakdown: Total MRP → Discount on MRP → Coupon → Delivery → Total payable.
 * No tax row, per the AZMARO wireframe. `mrpSavings` is display-only (the server prices the order).
 */
export function OrderSummaryRows({ totals, mrpSavings = 0, className }: { totals: OrderTotals; mrpSavings?: number; className?: string }) {
  const hasMrp = mrpSavings > 0;
  const totalSaved = mrpSavings + totals.discount;
  return (
    <div className={className}>
      <dl className="space-y-3 text-[0.8125rem]">
        {hasMrp ? (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Total MRP</dt>
              <dd className="font-semibold tabular-nums">{formatPrice(totals.subtotal + mrpSavings)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Discount on MRP</dt>
              <dd className="font-semibold text-success tabular-nums">– {formatPrice(mrpSavings)}</dd>
            </div>
          </>
        ) : (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-2">Subtotal</dt>
            <dd className="font-semibold tabular-nums">{formatPrice(totals.subtotal)}</dd>
          </div>
        )}
        {totals.discount > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-2">Coupon discount</dt>
            <dd className="font-semibold text-success tabular-nums">– {formatPrice(totals.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">Delivery</dt>
          <dd className="text-right font-semibold tabular-nums">
            {totals.delivery === null ? (
              <span className="text-xs font-normal text-muted">To be confirmed</span>
            ) : totals.delivery === 0 ? (
              <span className="text-success">Free</span>
            ) : (
              formatPrice(totals.delivery)
            )}
          </dd>
        </div>
      </dl>
      <div className="az-rule my-5" />
      <div className="flex items-baseline justify-between gap-4">
        <span className="az-label text-gold">Total payable</span>
        <span className="text-xl font-bold tabular-nums">{formatPrice(totals.total)}</span>
      </div>
      {totalSaved > 0 && (
        <p className={cn("mt-3 border border-success/30 bg-success/[0.07] px-3 py-2 text-center text-xs font-semibold text-success")}>
          You save {formatPrice(totalSaved)} on this order
        </p>
      )}
      {totals.delivery === null && (
        <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">
          Delivery charges, if any, are confirmed with you before dispatch and are not included in this total.
        </p>
      )}
    </div>
  );
}
