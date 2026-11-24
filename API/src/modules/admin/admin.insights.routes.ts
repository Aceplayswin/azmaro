import { z } from "zod";
import { db, limitOffset, raw, sql, where } from "../../db";
import type { Decimal } from "../../utils/money";
import { moduleRouter } from "../../routes/router";
import { toAmount } from "../../utils/money";
import { buildMeta, paginationQuery, toSkipTake } from "../../utils/pagination";
import { ok, paginated } from "../../utils/response";
import { booleanQuery } from "../../validators/common";

/**
 * Read-only insight endpoints for the admin panel: live cart activity
 * ("added to cart") and a sales report. Test orders are excluded from sales.
 */
export const adminInsightsRoutes = moduleRouter("/admin", "Admin · Insights");
const r = adminInsightsRoutes;

const cartQuery = paginationQuery.extend({
  owner: z.enum(["all", "customer", "guest"]).default("all"),
  includeEmpty: booleanQuery.optional(),
});

/** Cart value = Σ quantity × current selling price (unpriced sizes count as 0). */
const CART_ROLLUP = raw(`
  SELECT ci.cartId,
         COUNT(*) AS lineCount,
         SUM(ci.quantity) AS units,
         SUM(ci.quantity * COALESCE(v.price, 0)) AS value,
         MAX(ci.updatedAt) AS lastItemAt
  FROM cart_items ci JOIN product_variants v ON v.id = ci.variantId
  GROUP BY ci.cartId`);

r.get("/carts", {
  summary: "Shopping carts (add-to-cart activity)",
  description: "Live carts of signed-in customers and guests, newest activity first, with their items and current value.",
  auth: "admin",
  permission: "orders:read",
  query: cartQuery,
}, async (req, res) => {
  const q = cartQuery.parse(req.query);
  const condition = where([
    q.includeEmpty ? raw("") : raw("roll.cartId IS NOT NULL"),
    q.owner === "customer" ? raw("c.userId IS NOT NULL") : raw(""),
    q.owner === "guest" ? raw("c.userId IS NULL") : raw(""),
  ]);
  const from = sql`FROM carts c LEFT JOIN (${CART_ROLLUP}) roll ON roll.cartId = c.id LEFT JOIN users u ON u.id = c.userId`;

  const [count, carts] = await Promise.all([
    db.one<{ n: number }>(sql`SELECT COUNT(*) AS n ${from} ${condition}`),
    db.many<{
      id: string;
      userId: string | null;
      customerName: string | null;
      customerEmail: string | null;
      couponCode: string | null;
      deliveryPin: string | null;
      createdAt: Date;
      lastActivity: Date;
      lineCount: number | null;
      units: Decimal | null;
      value: Decimal | null;
    }>(sql`
      SELECT c.id, c.userId, u.name AS customerName, u.email AS customerEmail, c.couponCode, c.deliveryPin, c.createdAt,
             GREATEST(c.updatedAt, COALESCE(roll.lastItemAt, c.updatedAt)) AS lastActivity,
             roll.lineCount, roll.units, roll.value
      ${from} ${condition}
      ORDER BY lastActivity DESC, c.id ASC ${limitOffset(toSkipTake(q))}`),
  ]);

  const items = await db.many<{ cartId: string; slug: string; name: string; brand: string; sizeMl: number; quantity: number; price: Decimal | null; addedAt: Date }>(sql`
    SELECT ci.cartId, p.slug, p.name, b.name AS brand, v.sizeMl, ci.quantity, v.price, ci.createdAt AS addedAt
    FROM cart_items ci JOIN product_variants v ON v.id = ci.variantId JOIN products p ON p.id = v.productId JOIN brands b ON b.id = p.brandId
    WHERE ci.cartId IN (${carts.map((c) => c.id)})
    ORDER BY ci.createdAt ASC, ci.id ASC`);

  return paginated(
    res,
    carts.map((c) => ({
      id: c.id,
      owner: c.userId ? { type: "customer" as const, id: c.userId, name: c.customerName, email: c.customerEmail } : { type: "guest" as const },
      couponCode: c.couponCode,
      deliveryPin: c.deliveryPin,
      createdAt: c.createdAt,
      lastActivity: c.lastActivity,
      lines: c.lineCount ?? 0,
      units: Number(c.units ?? 0),
      value: toAmount(c.value ?? 0),
      items: items
        .filter((i) => i.cartId === c.id)
        .map((i) => ({ slug: i.slug, name: i.name, brand: i.brand, sizeMl: i.sizeMl, quantity: i.quantity, unitPrice: toAmount(i.price), addedAt: i.addedAt })),
    })),
    buildMeta(q, count!.n),
  );
});

r.get("/carts/summary", { summary: "Cart totals and the most-added products", auth: "admin", permission: "orders:read" }, async (_req, res) => {
  const [summary, topProducts] = await Promise.all([
    db.one<{ carts: number; customerCarts: number | null; units: Decimal | null; value: Decimal | null }>(sql`
      SELECT COUNT(*) AS carts, SUM(c.userId IS NOT NULL) AS customerCarts, SUM(roll.units) AS units, SUM(roll.value) AS value
      FROM carts c JOIN (${CART_ROLLUP}) roll ON roll.cartId = c.id`),
    db.many<{ slug: string; name: string; brand: string; units: Decimal; carts: number }>(sql`
      SELECT p.slug, p.name, b.name AS brand, SUM(ci.quantity) AS units, COUNT(DISTINCT ci.cartId) AS carts
      FROM cart_items ci JOIN product_variants v ON v.id = ci.variantId JOIN products p ON p.id = v.productId JOIN brands b ON b.id = p.brandId
      GROUP BY p.id ORDER BY units DESC, carts DESC LIMIT 5`),
  ]);
  return ok(res, {
    activeCarts: summary?.carts ?? 0,
    customerCarts: Number(summary?.customerCarts ?? 0),
    guestCarts: (summary?.carts ?? 0) - Number(summary?.customerCarts ?? 0),
    units: Number(summary?.units ?? 0),
    value: toAmount(summary?.value ?? 0),
    topProducts: topProducts.map((t) => ({ ...t, units: Number(t.units) })),
  });
});

const reportQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  includeTest: booleanQuery.optional(),
});

r.get("/reports/sales", {
  summary: "Sales report: orders and revenue per day, top products, payment methods, order statuses",
  description: "Revenue counts only paid orders. Cancelled orders are excluded from order counts and item totals.",
  auth: "admin",
  permission: "dashboard:read",
  query: reportQuery,
}, async (req, res) => {
  const { days, includeTest } = reportQuery.parse(req.query);
  const since = new Date(Date.now() - days * 86_400_000);
  const scope = sql`o.createdAt >= ${since} ${includeTest ? raw("") : raw("AND o.isTest = 0")}`;

  const [daily, totals, topProducts, methods, statuses] = await Promise.all([
    db.many<{ day: string; orders: number; ordered: Decimal | null; paid: Decimal | null }>(sql`
      SELECT DATE_FORMAT(o.createdAt, '%Y-%m-%d') AS day,
             SUM(o.status <> 'CANCELLED') AS orders,
             SUM(CASE WHEN o.status <> 'CANCELLED' THEN o.total ELSE 0 END) AS ordered,
             SUM(CASE WHEN o.paymentStatus = 'PAID' THEN o.total ELSE 0 END) AS paid
      FROM orders o WHERE ${scope}
      GROUP BY day ORDER BY day ASC`),
    db.one<{ orders: number; cancelled: number; ordered: Decimal | null; paid: Decimal | null; discounts: Decimal | null; customers: number }>(sql`
      SELECT SUM(o.status <> 'CANCELLED') AS orders, SUM(o.status = 'CANCELLED') AS cancelled,
             SUM(CASE WHEN o.status <> 'CANCELLED' THEN o.total ELSE 0 END) AS ordered,
             SUM(CASE WHEN o.paymentStatus = 'PAID' THEN o.total ELSE 0 END) AS paid,
             SUM(CASE WHEN o.status <> 'CANCELLED' THEN o.discountTotal ELSE 0 END) AS discounts,
             COUNT(DISTINCT o.email) AS customers
      FROM orders o WHERE ${scope}`),
    db.many<{ slug: string; name: string; brand: string; units: Decimal; revenue: Decimal }>(sql`
      SELECT oi.productSlug AS slug, oi.productName AS name, oi.brandName AS brand, SUM(oi.quantity) AS units, SUM(oi.lineTotal) AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.orderId
      WHERE ${scope} AND o.status <> 'CANCELLED'
      GROUP BY oi.productSlug, oi.productName, oi.brandName ORDER BY units DESC, revenue DESC LIMIT 10`),
    db.many<{ method: string; orders: number; amount: Decimal }>(sql`
      SELECT o.paymentMethod AS method, COUNT(*) AS orders, SUM(o.total) AS amount
      FROM orders o WHERE ${scope} AND o.status <> 'CANCELLED' GROUP BY o.paymentMethod ORDER BY orders DESC`),
    db.many<{ status: string; orders: number }>(sql`SELECT o.status, COUNT(*) AS orders FROM orders o WHERE ${scope} GROUP BY o.status`),
  ]);

  // One row per calendar day so charts have no gaps.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = new Date(since.getTime() + (i + 1) * 86_400_000).toISOString().slice(0, 10);
    const d = byDay.get(day);
    return { day, orders: Number(d?.orders ?? 0), ordered: toAmount(d?.ordered ?? 0), paid: toAmount(d?.paid ?? 0) };
  });
  const orders = Number(totals?.orders ?? 0);
  const ordered = toAmount(totals?.ordered ?? 0) ?? 0;

  return ok(res, {
    days,
    includeTest: Boolean(includeTest),
    totals: {
      orders,
      cancelled: Number(totals?.cancelled ?? 0),
      orderedValue: ordered,
      paidRevenue: toAmount(totals?.paid ?? 0),
      discounts: toAmount(totals?.discounts ?? 0),
      averageOrderValue: orders ? Math.round((ordered / orders) * 100) / 100 : 0,
      customers: Number(totals?.customers ?? 0),
    },
    series,
    topProducts: topProducts.map((t) => ({ ...t, units: Number(t.units), revenue: toAmount(t.revenue) })),
    paymentMethods: methods.map((m) => ({ method: m.method, orders: m.orders, amount: toAmount(m.amount) })),
    statuses: Object.fromEntries(statuses.map((s) => [s.status, s.orders])),
  });
});
