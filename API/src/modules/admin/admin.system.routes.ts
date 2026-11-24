import { z } from "zod";
import { env, integrations } from "../../config/env";
import { paymentIntegrationStatus } from "../../integrations/payments";
import { shippingIntegrationStatus } from "../../integrations/shipping";
import { db, limitOffset, raw, sql, where, type AuditLogRow, type OrderRecord, type Sql } from "../../db";
import { moduleRouter } from "../../routes/router";
import { toAmount, type Decimal } from "../../utils/money";
import { buildMeta, paginationQuery, toSkipTake } from "../../utils/pagination";
import { ok, paginated } from "../../utils/response";
import { getSetting, settingSchemas, updateSetting, type SettingKey } from "../settings/settings.service";
import { audit } from "./audit";

export const adminSystemRoutes = moduleRouter("/admin", "Admin · System");
const r = adminSystemRoutes;

r.get("/dashboard", { summary: "Dashboard statistics", auth: "admin", permission: "dashboard:read" }, async (_req, res) => {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const n = async (q: Sql) => (await db.one<{ n: number }>(q))!.n;
  const paidSum = async (q: Sql) => (await db.one<{ total: Decimal | null }>(q))?.total ?? null;
  const [
    ordersByStatus,
    revenuePaid,
    revenue30,
    orderCount30,
    customers,
    newCustomers30,
    products,
    pricedProducts,
    approvedImageProducts,
    pendingImages,
    newMessages,
    subscribers,
    recentOrders,
    lowStock,
    testOrders,
  ] = await Promise.all([
    db.many<{ status: string; count: number }>(sql`SELECT status, COUNT(*) AS count FROM orders WHERE isTest = 0 GROUP BY status`),
    paidSum(sql`SELECT SUM(total) AS total FROM orders WHERE isTest = 0 AND paymentStatus = 'PAID'`),
    paidSum(sql`SELECT SUM(total) AS total FROM orders WHERE isTest = 0 AND paymentStatus = 'PAID' AND createdAt >= ${since30}`),
    n(sql`SELECT COUNT(*) AS n FROM orders WHERE isTest = 0 AND createdAt >= ${since30} AND status <> 'CANCELLED'`),
    n(sql`SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.roleId WHERE r.name = 'CUSTOMER'`),
    n(sql`SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.roleId WHERE r.name = 'CUSTOMER' AND u.createdAt >= ${since30}`),
    n(sql`SELECT COUNT(*) AS n FROM products`),
    n(sql`SELECT COUNT(*) AS n FROM products WHERE minPrice IS NOT NULL`),
    n(sql`SELECT COUNT(*) AS n FROM products p WHERE EXISTS (SELECT 1 FROM product_images i WHERE i.productId = p.id AND i.status = 'APPROVED')`),
    n(sql`SELECT COUNT(*) AS n FROM product_images WHERE status = 'PENDING_REVIEW'`),
    n(sql`SELECT COUNT(*) AS n FROM contact_messages WHERE status = 'NEW'`),
    n(sql`SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE status = 'SUBSCRIBED'`),
    db.many<Pick<OrderRecord, "id" | "orderNumber" | "status" | "paymentStatus" | "total" | "isTest" | "createdAt">>(
      sql`SELECT id, orderNumber, status, paymentStatus, total, isTest, createdAt FROM orders ORDER BY createdAt DESC, id DESC LIMIT 8`,
    ),
    db.many<{ variantId: string; product: string; slug: string; sizeMl: number; quantity: number }>(sql`
      SELECT i.variantId, p.name AS product, p.slug, v.sizeMl, i.quantity
      FROM inventory i JOIN product_variants v ON v.id = i.variantId JOIN products p ON p.id = v.productId
      WHERE i.quantity IS NOT NULL AND i.quantity <= 5
      LIMIT 20`),
    n(sql`SELECT COUNT(*) AS n FROM orders WHERE isTest = 1`),
  ]);
  return ok(res, {
    orders: {
      byStatus: Object.fromEntries(ordersByStatus.map((o) => [o.status, o.count])),
      last30Days: orderCount30,
      testOrders,
    },
    revenue: {
      /** Only payments confirmed by a provider (or COD collected on delivery); test orders excluded. */
      paidTotal: toAmount(revenuePaid ?? 0),
      paidLast30Days: toAmount(revenue30 ?? 0),
      currency: "INR",
    },
    customers: { total: customers, newLast30Days: newCustomers30 },
    catalogue: {
      products,
      withConfirmedPrice: pricedProducts,
      awaitingPrice: products - pricedProducts,
      withApprovedImage: approvedImageProducts,
      imagesPendingReview: pendingImages,
    },
    support: { newMessages, newsletterSubscribers: subscribers },
    recentOrders: recentOrders.map((o) => ({ ...o, total: toAmount(o.total) })),
    lowStock,
  });
});

const KEYS = Object.keys(settingSchemas) as SettingKey[];

r.get("/settings", { summary: "Business settings (shipping charges, COD rules, cancellation policy, support contacts)", auth: "admin", permission: "settings:read" }, async (_req, res) => {
  const entries = await Promise.all(KEYS.map(async (k) => [k, await getSetting(k)] as const));
  return ok(res, Object.fromEntries(entries));
});

const settingKeyParam = z.enum(KEYS as [SettingKey, ...SettingKey[]]);

r.put("/settings/:key", {
  summary: "Update one settings group (shipping | payments | orders | support)",
  description: "Partial updates are merged and validated. Secrets (API keys) are NOT settings – they live in environment variables.",
  auth: "admin",
  permission: "settings:write",
  body: z.record(z.string(), z.unknown()),
}, async (req, res) => {
  const key = settingKeyParam.parse(req.params.key);
  const value = await updateSetting(key, req.body, req.auth!.userId);
  await audit(req, "settings.update", "setting", key, { fields: Object.keys(req.body ?? {}) });
  return ok(res, value, "Settings updated.");
});

r.get("/integrations", { summary: "Payment, courier and email integration status (no secrets)", auth: "admin", permission: "settings:read" }, (_req, res) => {
  return ok(res, {
    mode: env.INTEGRATION_MODE,
    payments: paymentIntegrationStatus(),
    shipping: shippingIntegrationStatus(),
    email: { configured: integrations.email },
    contactWebhook: Boolean(env.CONTACT_WEBHOOK_URL),
    newsletterWebhook: Boolean(env.NEWSLETTER_WEBHOOK_URL),
  });
});

const auditQuery = paginationQuery.extend({ entity: z.string().max(60).optional() });
r.get("/audit-log", { summary: "Admin audit log", auth: "admin", permission: "audit:read", query: auditQuery }, async (req, res) => {
  const q = auditQuery.parse(req.query);
  const condition = where([q.entity ? sql`a.entity = ${q.entity}` : raw("")]);
  const [total, rows] = await Promise.all([
    db.one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM audit_logs a ${condition}`),
    db.many<AuditLogRow & { userName: string | null; userEmail: string | null }>(sql`
      SELECT a.*, u.name AS userName, u.email AS userEmail
      FROM audit_logs a LEFT JOIN users u ON u.id = a.userId
      ${condition}
      ORDER BY a.createdAt DESC, a.id DESC ${limitOffset(toSkipTake(q))}`),
  ]);
  return paginated(
    res,
    rows.map(({ userName, userEmail, ...a }) => ({ ...a, user: a.userId && userEmail ? { name: userName, email: userEmail } : null })),
    buildMeta(q, total!.n),
  );
});
