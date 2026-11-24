"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { useCheckoutPrefs } from "@/lib/cart/checkout-prefs";
import { computeTotals, resolveLines } from "@/lib/cart/pricing";
import type { ProductSummary } from "@/lib/catalogue/summary";
import type { ServiceabilityResult } from "@/types/api";

interface DiscountState {
  code: string;
  amount: number;
  valid: boolean;
  message: string;
}

/**
 * Bag / checkout quote. Discount and delivery values come from the server
 * (configured codes and the shipping adapter) – never from client guesses.
 */
export function useOrderQuote(products: ProductSummary[]) {
  const { lines, count, setQty, remove, clear } = useCart();
  const prefs = useCheckoutPrefs();
  const resolved = useMemo(() => resolveLines(lines, products), [lines, products]);
  const purchasable = resolved.filter((l) => l.available);
  const subtotal = purchasable.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const linesKey = JSON.stringify(purchasable.map((l) => [l.slug, l.sizeMl, l.qty]));

  const [discount, setDiscount] = useState<DiscountState | null>(null);
  const [delivery, setDelivery] = useState<ServiceabilityResult | null>(null);

  // (Re)validate the stored discount code whenever the bag changes.
  useEffect(() => {
    const code = prefs.discountCode;
    if (!code || !purchasable.length) return;
    let cancelled = false;
    fetch("/api/discount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, lines: purchasable.map(({ slug, sizeMl, qty }) => ({ slug, sizeMl, qty })) }),
    })
      .then((r) => r.json())
      .then((d: DiscountState & { ok?: boolean }) => {
        if (!cancelled) setDiscount({ code, amount: d.amount ?? 0, valid: Boolean(d.valid), message: d.message ?? "" });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.discountCode, linesKey]);

  // Delivery fee / serviceability for the stored PIN.
  useEffect(() => {
    const pin = prefs.pin;
    if (!pin || !purchasable.length) return;
    let cancelled = false;
    fetch("/api/shipping/serviceability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, subtotal }),
    })
      .then(async (r) => {
        const d = (await r.json()) as ServiceabilityResult;
        // Ignore error replies (e.g. rate limited) – they carry no fee and would show as NaN.
        if (!r.ok || typeof d.status !== "string") throw new Error("delivery check failed");
        return d;
      })
      .then((d) => {
        if (!cancelled) setDelivery(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.pin, subtotal]);

  const activeDiscount = prefs.discountCode && discount?.code === prefs.discountCode && discount.valid ? discount.amount : 0;
  const deliveryFee =
    prefs.pin && delivery && delivery.status !== "unserviceable" && typeof delivery.fee === "number" && Number.isFinite(delivery.fee) ? delivery.fee : null;
  const totals = computeTotals(resolved, activeDiscount, deliveryFee);

  return {
    lines: resolved,
    count,
    totals,
    discount: prefs.discountCode ? discount : null,
    delivery: prefs.pin ? delivery : null,
    prefs,
    setQty,
    remove,
    clear,
  };
}
