/**
 * Order maths shared by bag, checkout and the order API.
 * The server always recomputes totals from catalogue data – client totals are display-only.
 * There is intentionally no tax line (per the AZMARO wireframe).
 */
import type { ProductSummary } from "@/lib/catalogue/summary";
import type { CartLine } from "./index";

export interface ResolvedLine extends CartLine {
  product: ProductSummary;
  unitPrice: number | null;
  /** MRP per unit, when a real MRP above the price exists */
  unitMrp: number | null;
  lineTotal: number | null;
  available: boolean;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  /** null = not yet known (courier / delivery fee not configured) */
  delivery: number | null;
  total: number;
  hasUnpricedItems: boolean;
}

export function resolveLines(lines: CartLine[], products: ProductSummary[]): ResolvedLine[] {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  return lines.flatMap((line) => {
    const product = bySlug.get(line.slug);
    if (!product) return [];
    const variant = product.variants.find((v) => v.sizeMl === line.sizeMl);
    const unitPrice = variant?.price ?? null;
    const available = unitPrice !== null && variant?.stockStatus !== "out_of_stock";
    const unitMrp = variant?.mrp != null && unitPrice !== null && variant.mrp > unitPrice ? variant.mrp : null;
    return [{ ...line, product, unitPrice, unitMrp, lineTotal: unitPrice === null ? null : unitPrice * line.qty, available }];
  });
}

/** Total saved against MRP on the orderable lines (display only). */
export const mrpSavings = (lines: ResolvedLine[]) =>
  lines.reduce((s, l) => s + (l.available && l.unitMrp !== null && l.unitPrice !== null ? (l.unitMrp - l.unitPrice) * l.qty : 0), 0);

export function computeTotals(lines: ResolvedLine[], discount: number, delivery: number | null): OrderTotals {
  const subtotal = lines.reduce((sum, l) => sum + (l.available && l.lineTotal ? l.lineTotal : 0), 0);
  const safeDiscount = Math.min(Math.max(0, Math.round(discount)), subtotal);
  return {
    subtotal,
    discount: safeDiscount,
    delivery,
    total: subtotal - safeDiscount + (delivery ?? 0),
    hasUnpricedItems: lines.some((l) => !l.available),
  };
}
