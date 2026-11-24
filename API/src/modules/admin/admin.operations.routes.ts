import { z } from "zod";
import {
  db,
  insert,
  join,
  likeContains,
  limitOffset,
  raw,
  sql,
  transaction,
  update,
  where,
  ORDER_STATUSES,
  SHIPMENT_STATUSES,
  type AddressRow,
  type ContactMessageRow,
  type CouponRow,
  type FaqRow,
  type NewsletterSubscriberRow,
  type OrderRecord,
  type RoleRow,
  type Sql,
  type UserRow,
} from "../../db";
import { moduleRouter } from "../../routes/router";
import { conflict, forbidden, notFound, unprocessable } from "../../utils/errors";
import { toAmount, type Decimal } from "../../utils/money";
import { buildMeta, paginationQuery, toSkipTake } from "../../utils/pagination";
import { created, ok, paginated } from "../../utils/response";
import { addressInput, booleanQuery, id, indianPhone, moneyAmount, nonEmpty } from "../../validators/common";
import { findOrder, loadOrders, toAdminOrderDto, withCustomers } from "../orders/order.dto";
import { cancelStalePendingOrders, transitionOrder } from "../orders/order.service";
import { refundOrderPayment } from "../payments/payment.service";
import { addShipmentEvent, bookShipment, refreshFromCourier, updateShipment } from "../shipping/shipping.service";
import { audit } from "./audit";


export const adminOrderQuery = paginationQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().trim().max(191).optional().describe("Order number or customer email"),
  isTest: booleanQuery.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
const statusSchema = z.object({ status: z.enum(ORDER_STATUSES), note: z.string().trim().max(500).optional() });
const bookSchema = z.object({ courier: z.string().trim().min(2).max(80).optional(), awb: z.string().trim().min(3).max(64).optional() });
const shipmentPatchSchema = z.object({
  courier: z.string().trim().min(2).max(80).optional(),
  awb: z.string().trim().min(3).max(64).optional(),
  labelUrl: z.string().url().max(500).nullable().optional(),
});
const eventSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES),
  description: nonEmpty("Description", 500, 3),
  location: z.string().trim().max(160).optional(),
  occurredAt: z.coerce.date().optional(),
});
const staleSchema = z.object({ olderThanMinutes: z.number().int().min(15).max(10_080).default(60) });

const customerQuery = paginationQuery.extend({ q: z.string().trim().max(191).optional(), role: z.string().max(32).optional() });
const customerPatchSchema = z.object({
  name: nonEmpty("Full name", 120).optional(),
  phone: indianPhone.nullable().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["CUSTOMER", "STAFF", "ADMIN"]).optional(),
});
/** Optional text where null / "" clears the value. */
const clearableText = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((v) => (v === "" ? null : v));
const customerAddressSchema = addressInput.extend({
  label: clearableText(40),
  line2: clearableText(255),
  landmark: clearableText(120),
  isDefault: z.boolean().default(false),
});

const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, "Use 3–40 letters, numbers, _ or -."),
  description: z.string().trim().max(255).nullable().optional(),
  type: z.enum(["PERCENT", "FLAT"]),
  value: moneyAmount,
  minSubtotal: moneyAmount.nullable().optional(),
  maxDiscount: moneyAmount.nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});
const contactPatchSchema = z.object({ status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "SPAM"]).optional(), adminNote: z.string().max(1000).nullable().optional() });
const faqSchema = z.object({
  question: nonEmpty("Question", 255, 5),
  answer: nonEmpty("Answer", 5000, 5),
  category: nonEmpty("Category", 60),
  sortOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

const count = async (table: string, condition: Sql) =>
  (await db.one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM ${raw(table)} ${where([condition])}`))!.n;

/** Throw 404 when an UPDATE / DELETE matched no row. */
const found = (matched: number, what: string) => {
  if (!matched) throw notFound(what);
};

/** Contact messages without the hashed IP. */
const CONTACT_COLUMNS = raw("id, name, email, phone, orderNumber, message, status, adminNote, createdAt, updatedAt");
/** Subscribers without the unsubscribe token. */
const SUBSCRIBER_COLUMNS = raw("id, email, status, source, subscribedAt, unsubscribedAt, updatedAt");

export const adminOperationsRoutes = moduleRouter("/admin", "Admin · Operations");
const r = adminOperationsRoutes;

// ─────────── Orders ───────────

r.get("/orders", { summary: "Orders (filter by status, search, date, test flag)", auth: "admin", permission: "orders:read", query: adminOrderQuery }, async (req, res) => {
  const q = adminOrderQuery.parse(req.query);
  const condition = join(
    [
      q.status ? sql`status = ${q.status}` : raw(""),
      q.isTest !== undefined ? sql`isTest = ${q.isTest}` : raw(""),
      q.q ? sql`(orderNumber LIKE ${likeContains(q.q.toUpperCase())} OR email LIKE ${likeContains(q.q.toLowerCase())})` : raw(""),
      q.from ? sql`createdAt >= ${q.from}` : raw(""),
      q.to ? sql`createdAt <= ${q.to}` : raw(""),
    ],
    " AND ",
  );
  const [total, records] = await Promise.all([
    count("orders", condition),
    db.many<OrderRecord>(sql`SELECT * FROM orders ${where([condition])} ORDER BY createdAt DESC, id DESC ${limitOffset(toSkipTake(q))}`),
  ]);
  const rows = await withCustomers(await loadOrders(records));
  return paginated(res, rows.map(toAdminOrderDto), buildMeta(q, total));
});

r.get("/orders/:id", { summary: "Order detail (admin)", auth: "admin", permission: "orders:read" }, async (req, res) => {
  const order = await findOrder(sql`id = ${id.parse(req.params.id)}`);
  if (!order) throw notFound("Order");
  const [withUser] = await withCustomers([order]);
  return ok(res, toAdminOrderDto(withUser!));
});

r.patch("/orders/:id/status", {
  summary: "Change order status",
  description: "Transitions are validated (e.g. SHIPPED → DELIVERED). Cancelling restocks inventory and releases coupon usage.",
  auth: "admin",
  permission: "orders:write",
  body: statusSchema,
}, async (req, res) => {
  const input = statusSchema.parse(req.body);
  const orderId = id.parse(req.params.id);
  const order = await transitionOrder(orderId, input.status, req.auth!.userId, input.note);
  await audit(req, "order.status", "order", orderId, { status: input.status });
  return ok(res, toAdminOrderDto(order), "Order status updated.");
});

r.post("/orders/:id/refund", { summary: "Refund the paid amount via the payment provider", auth: "admin", permission: "payments:write" }, async (req, res) => {
  const orderId = id.parse(req.params.id);
  const refund = await refundOrderPayment(orderId);
  await audit(req, "order.refund", "order", orderId, { refundId: refund.id });
  return ok(res, refund, "Refund requested from the payment provider.");
});

r.post("/orders/maintenance/release-stale", {
  summary: "Cancel unpaid online orders older than N minutes (releases reserved stock)",
  auth: "admin",
  permission: "orders:write",
  body: staleSchema,
}, async (req, res) => {
  const { olderThanMinutes } = staleSchema.parse(req.body ?? {});
  const cancelled = await cancelStalePendingOrders(olderThanMinutes, req.auth!.userId);
  await audit(req, "order.release_stale", "order", null, { count: cancelled.length });
  return ok(res, { cancelled }, `${cancelled.length} order(s) cancelled.`);
});

// ─────────── Shipments / AWB ───────────

r.post("/orders/:id/shipments", {
  summary: "Book a shipment",
  description: "With a courier connected and no body, the shipment is created via the courier API. Otherwise send { courier, awb } to record a manually booked shipment.",
  auth: "admin",
  permission: "shipping:write",
  body: bookSchema,
  successStatus: 201,
}, async (req, res) => {
  const orderId = id.parse(req.params.id);
  const input = bookSchema.parse(req.body ?? {});
  if ((input.courier && !input.awb) || (!input.courier && input.awb)) throw unprocessable("Provide both courier and AWB for a manual booking.");
  const shipment = await bookShipment(orderId, input, req.auth!.userId);
  await audit(req, "shipment.book", "shipment", shipment.id, { orderId, provider: shipment.provider, awb: shipment.awb });
  return created(res, shipment, "Shipment booked.");
});

r.patch("/shipments/:id", { summary: "Update courier / AWB / label", auth: "admin", permission: "shipping:write", body: shipmentPatchSchema }, async (req, res) => {
  const shipmentId = id.parse(req.params.id);
  const shipment = await updateShipment(shipmentId, shipmentPatchSchema.parse(req.body));
  await audit(req, "shipment.update", "shipment", shipmentId);
  return ok(res, shipment, "Shipment updated.");
});

r.post("/shipments/:id/events", {
  summary: "Record a confirmed delivery status update (source ADMIN)",
  description: "Use for manually booked shipments. Only record events confirmed by the courier.",
  auth: "admin",
  permission: "shipping:write",
  body: eventSchema,
  successStatus: 201,
}, async (req, res) => {
  const shipmentId = id.parse(req.params.id);
  const input = eventSchema.parse(req.body);
  const result = await addShipmentEvent(shipmentId, input, "ADMIN", req.auth!.userId);
  await audit(req, "shipment.event", "shipment", shipmentId, { status: input.status });
  return created(res, result.event, "Shipment event recorded.");
});

r.post("/shipments/:id/refresh", { summary: "Pull latest scans from the courier", auth: "admin", permission: "shipping:write" }, async (req, res) => {
  const added = await refreshFromCourier(id.parse(req.params.id));
  return ok(res, { added }, added ? `${added} new event(s).` : "No new courier events (or no courier connected).");
});

// ─────────── Customers ───────────

r.get("/customers", { summary: "Customers (admin only – contains personal data)", auth: "admin", permission: "customers:read", query: customerQuery }, async (req, res) => {
  const q = customerQuery.parse(req.query);
  const condition = where([
    q.q ? sql`(u.email LIKE ${likeContains(q.q.toLowerCase())} OR u.name LIKE ${likeContains(q.q)})` : raw(""),
    q.role ? sql`r.name = ${q.role}` : raw(""),
  ]);
  const from = raw("FROM users u JOIN roles r ON r.id = u.roleId");
  const [total, rows] = await Promise.all([
    db.one<{ n: number }>(sql`SELECT COUNT(*) AS n ${from} ${condition}`),
    db.many<UserRow & { roleName: string; orderCount: number; addressCount: number; location: string | null; totalSpent: Decimal | null }>(sql`
      SELECT u.*, r.name AS roleName,
        (SELECT COUNT(*) FROM orders o WHERE o.userId = u.id) AS orderCount,
        (SELECT COUNT(*) FROM addresses a WHERE a.userId = u.id) AS addressCount,
        (SELECT CONCAT(a.city, ', ', a.state, ' ', a.pin) FROM addresses a WHERE a.userId = u.id ORDER BY a.isDefault DESC, a.createdAt DESC LIMIT 1) AS location,
        (SELECT SUM(o.total) FROM orders o WHERE o.userId = u.id AND o.status <> 'CANCELLED' AND o.isTest = 0) AS totalSpent
      ${from} ${condition}
      ORDER BY u.createdAt DESC, u.id DESC ${limitOffset(toSkipTake(q))}`),
  ]);
  return paginated(
    res,
    rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.roleName,
      isActive: u.isActive,
      emailVerified: Boolean(u.emailVerifiedAt),
      orders: u.orderCount,
      addresses: u.addressCount,
      location: u.location,
      totalSpent: toAmount(u.totalSpent ?? 0),
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
    buildMeta(q, total!.n),
  );
});

r.get("/customers/:id", { summary: "Customer detail with order summary", auth: "admin", permission: "customers:read" }, async (req, res) => {
  const userId = id.parse(req.params.id);
  const user = await db.one<UserRow>(sql`SELECT * FROM users WHERE id = ${userId}`);
  if (!user) throw notFound("Customer");
  const [role, addresses, orders] = await Promise.all([
    db.one<RoleRow>(sql`SELECT * FROM roles WHERE id = ${user.roleId}`),
    db.many<AddressRow>(sql`SELECT * FROM addresses WHERE userId = ${userId} ORDER BY createdAt ASC, id ASC`),
    db.many<Pick<OrderRecord, "id" | "orderNumber" | "status" | "paymentStatus" | "total" | "createdAt" | "isTest">>(
      sql`SELECT id, orderNumber, status, paymentStatus, total, createdAt, isTest FROM orders WHERE userId = ${userId} ORDER BY createdAt DESC, id DESC LIMIT 20`,
    ),
  ]);
  const { passwordHash, tokenVersion, ...safe } = user;
  void passwordHash;
  void tokenVersion;
  return ok(res, { ...safe, role: role!.name, addresses, orders: orders.map((o) => ({ ...o, total: toAmount(o.total) })) });
});

r.patch("/customers/:id", { summary: "Edit name / phone, activate / deactivate or change role", auth: "admin", permission: "customers:write", body: customerPatchSchema }, async (req, res) => {
  const userId = id.parse(req.params.id);
  const input = customerPatchSchema.parse(req.body);
  const changesAccess = input.isActive !== undefined || input.role !== undefined;
  if (changesAccess && userId === req.auth!.userId) throw forbidden("You cannot change your own role or status.");
  const role = input.role ? await db.one<RoleRow>(sql`SELECT * FROM roles WHERE name = ${input.role}`) : null;
  if (input.role && !role) throw notFound("Role");
  await transaction(async (tx) => {
    found(await update(tx, "users", { name: input.name, phone: input.phone }, sql`id = ${userId}`), "Customer");
    if (!changesAccess) return;
    // Access changes sign the person out everywhere (tokenVersion bump).
    await tx.run(sql`
      UPDATE users SET tokenVersion = tokenVersion + 1
        ${input.isActive !== undefined ? sql`, isActive = ${input.isActive}` : raw("")}
        ${role ? sql`, roleId = ${role.id}` : raw("")}
      WHERE id = ${userId}`);
    if (input.isActive === false) await update(tx, "sessions", { revokedAt: new Date() }, sql`userId = ${userId} AND revokedAt IS NULL`);
  });
  await audit(req, "customer.update", "user", userId, input);
  return ok(res, null, "Customer updated.");
});

// Customer address book (admin)
async function customerAddress(customerId: string, addressId: string) {
  const a = await db.one<AddressRow>(sql`SELECT * FROM addresses WHERE id = ${addressId} AND userId = ${customerId}`);
  if (!a) throw notFound("Address");
  return a;
}

r.post("/customers/:id/addresses", { summary: "Add an address to a customer's address book", auth: "admin", permission: "customers:write", body: customerAddressSchema, successStatus: 201 }, async (req, res) => {
  const userId = id.parse(req.params.id);
  const input = customerAddressSchema.parse(req.body);
  if (!(await db.one(sql`SELECT id FROM users WHERE id = ${userId}`))) throw notFound("Customer");
  const addressId = await transaction(async (tx) => {
    const { n } = (await tx.one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM addresses WHERE userId = ${userId}`))!;
    const isDefault = input.isDefault || n === 0;
    if (isDefault) await update(tx, "addresses", { isDefault: false }, sql`userId = ${userId}`);
    return insert(tx, "addresses", { ...input, label: input.label ?? null, line2: input.line2 ?? null, landmark: input.landmark ?? null, isDefault, userId });
  });
  await audit(req, "customer.address_create", "user", userId, { addressId });
  return created(res, await customerAddress(userId, addressId), "Address added.");
});

r.patch("/customers/:id/addresses/:addressId", { summary: "Edit a customer's address (or make it the default)", auth: "admin", permission: "customers:write", body: customerAddressSchema.partial() }, async (req, res) => {
  const userId = id.parse(req.params.id);
  const addressId = id.parse(req.params.addressId);
  const input = customerAddressSchema.partial().parse(req.body);
  await customerAddress(userId, addressId);
  await transaction(async (tx) => {
    if (input.isDefault) await update(tx, "addresses", { isDefault: false }, sql`userId = ${userId}`);
    await update(tx, "addresses", input, sql`id = ${addressId}`);
  });
  await audit(req, "customer.address_update", "user", userId, { addressId, fields: Object.keys(input) });
  return ok(res, await customerAddress(userId, addressId), "Address updated.");
});

r.delete("/customers/:id/addresses/:addressId", { summary: "Remove a customer's address", auth: "admin", permission: "customers:write" }, async (req, res) => {
  const userId = id.parse(req.params.id);
  const addressId = id.parse(req.params.addressId);
  const existing = await customerAddress(userId, addressId);
  await transaction(async (tx) => {
    await tx.run(sql`DELETE FROM addresses WHERE id = ${addressId}`);
    if (existing.isDefault) {
      const next = await tx.one<{ id: string }>(sql`SELECT id FROM addresses WHERE userId = ${userId} ORDER BY createdAt DESC, id DESC LIMIT 1`);
      if (next) await update(tx, "addresses", { isDefault: true }, sql`id = ${next.id}`);
    }
  });
  await audit(req, "customer.address_delete", "user", userId, { addressId });
  return ok(res, null, "Address removed.");
});

// ─────────── Coupons ───────────

const findCoupon = (couponId: string) => db.one<CouponRow>(sql`SELECT * FROM coupons WHERE id = ${couponId}`);

r.get("/coupons", { summary: "Coupons", auth: "admin", permission: "coupons:read" }, async (_req, res) => {
  const coupons = await db.many<CouponRow>(sql`SELECT * FROM coupons ORDER BY createdAt DESC, id DESC`);
  return ok(res, coupons.map((c) => ({ ...c, value: toAmount(c.value), minSubtotal: toAmount(c.minSubtotal), maxDiscount: toAmount(c.maxDiscount) })));
});
r.post("/coupons", { summary: "Create a coupon", auth: "admin", permission: "coupons:write", body: couponSchema, successStatus: 201 }, async (req, res) => {
  const input = couponSchema.parse(req.body);
  if (input.type === "PERCENT" && Number(input.value) > 100) throw unprocessable("Percentage discounts cannot exceed 100.");
  const coupon = (await findCoupon(await insert(db, "coupons", input)))!;
  await audit(req, "coupon.create", "coupon", coupon.id, { code: coupon.code });
  return created(res, coupon, "Coupon created.");
});
r.patch("/coupons/:id", { summary: "Update a coupon", auth: "admin", permission: "coupons:write", body: couponSchema.partial() }, async (req, res) => {
  const couponId = id.parse(req.params.id);
  found(await update(db, "coupons", couponSchema.partial().parse(req.body), sql`id = ${couponId}`), "Coupon");
  const coupon = await findCoupon(couponId);
  await audit(req, "coupon.update", "coupon", couponId);
  return ok(res, coupon, "Coupon updated.");
});
r.delete("/coupons/:id", { summary: "Delete an unused coupon (deactivate used ones)", auth: "admin", permission: "coupons:write" }, async (req, res) => {
  const couponId = id.parse(req.params.id);
  if (await count("coupon_redemptions", sql`couponId = ${couponId}`)) throw conflict("This coupon has been used. Deactivate it instead.", undefined, "COUPON_USED");
  found((await db.run(sql`DELETE FROM coupons WHERE id = ${couponId}`)).affectedRows, "Coupon");
  await audit(req, "coupon.delete", "coupon", couponId);
  return ok(res, null, "Coupon deleted.");
});

// ─────────── Support inbox, newsletter, FAQs ───────────

const contactQuery = paginationQuery.extend({ status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "SPAM"]).optional() });
r.get("/contact-messages", { summary: "Contact form submissions", auth: "admin", permission: "support:read", query: contactQuery }, async (req, res) => {
  const q = contactQuery.parse(req.query);
  const condition = q.status ? sql`status = ${q.status}` : raw("");
  const [total, rows] = await Promise.all([
    count("contact_messages", condition),
    db.many<ContactMessageRow>(sql`SELECT ${CONTACT_COLUMNS} FROM contact_messages ${where([condition])} ORDER BY createdAt DESC, id DESC ${limitOffset(toSkipTake(q))}`),
  ]);
  return paginated(res, rows, buildMeta(q, total));
});
r.patch("/contact-messages/:id", { summary: "Update a message's status / note", auth: "admin", permission: "support:write", body: contactPatchSchema }, async (req, res) => {
  const msgId = id.parse(req.params.id);
  found(await update(db, "contact_messages", contactPatchSchema.parse(req.body), sql`id = ${msgId}`), "Message");
  const msg = (await db.one<ContactMessageRow>(sql`SELECT ${CONTACT_COLUMNS} FROM contact_messages WHERE id = ${msgId}`))!;
  await audit(req, "contact.update", "contact_message", msg.id, { status: msg.status });
  return ok(res, msg, "Message updated.");
});

const subscriberQuery = paginationQuery.extend({ status: z.enum(["SUBSCRIBED", "UNSUBSCRIBED"]).optional(), format: z.enum(["json", "csv"]).default("json") });
r.get("/newsletter-subscribers", { summary: "Newsletter subscribers (JSON or CSV export)", auth: "admin", permission: "newsletter:read", query: subscriberQuery }, async (req, res) => {
  const q = subscriberQuery.parse(req.query);
  const condition = q.status ? sql`status = ${q.status}` : raw("");
  if (q.format === "csv") {
    const rows = await db.many<NewsletterSubscriberRow>(sql`SELECT ${SUBSCRIBER_COLUMNS} FROM newsletter_subscribers ${where([condition])} ORDER BY subscribedAt ASC, id ASC`);
    await audit(req, "newsletter.export", "newsletter", null, { count: rows.length });
    const csv = ["email,status,source,subscribed_at,unsubscribed_at", ...rows.map((s) => [s.email, s.status, s.source ?? "", s.subscribedAt.toISOString(), s.unsubscribedAt?.toISOString() ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="azmaro-newsletter.csv"');
    return res.send(csv);
  }
  const [total, rows] = await Promise.all([
    count("newsletter_subscribers", condition),
    db.many(sql`SELECT ${SUBSCRIBER_COLUMNS} FROM newsletter_subscribers ${where([condition])} ORDER BY subscribedAt DESC, id DESC ${limitOffset(toSkipTake(q))}`),
  ]);
  return paginated(res, rows, buildMeta(q, total));
});

r.get("/faqs", { summary: "All FAQs", auth: "admin", permission: "support:read" }, async (_req, res) => {
  return ok(res, await db.many<FaqRow>(sql`SELECT * FROM faqs ORDER BY category ASC, sortOrder ASC`));
});
const findFaq = (faqId: string) => db.one<FaqRow>(sql`SELECT * FROM faqs WHERE id = ${faqId}`);
r.post("/faqs", { summary: "Create an FAQ", auth: "admin", permission: "support:write", body: faqSchema, successStatus: 201 }, async (req, res) => {
  const faq = (await findFaq(await insert(db, "faqs", faqSchema.parse(req.body))))!;
  await audit(req, "faq.create", "faq", faq.id);
  return created(res, faq, "FAQ created.");
});
r.patch("/faqs/:id", { summary: "Update an FAQ", auth: "admin", permission: "support:write", body: faqSchema.partial() }, async (req, res) => {
  const faqId = id.parse(req.params.id);
  found(await update(db, "faqs", faqSchema.partial().parse(req.body), sql`id = ${faqId}`), "FAQ");
  const faq = (await findFaq(faqId))!;
  await audit(req, "faq.update", "faq", faq.id);
  return ok(res, faq, "FAQ updated.");
});
r.delete("/faqs/:id", { summary: "Delete an FAQ", auth: "admin", permission: "support:write" }, async (req, res) => {
  const faqId = id.parse(req.params.id);
  found((await db.run(sql`DELETE FROM faqs WHERE id = ${faqId}`)).affectedRows, "FAQ");
  await audit(req, "faq.delete", "faq", faqId);
  return ok(res, null, "FAQ deleted.");
});
