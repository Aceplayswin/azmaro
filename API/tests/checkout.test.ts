import { beforeAll, describe, expect, it } from "vitest";
import type { CouponRow, InventoryRow, OrderRecord, OrderStatusHistoryRow, ProductVariantRow } from "../src/db";
import { address, adminClient, client, countRows, db, findRow, priceProduct, registerCustomer, sql, uniqueEmail } from "./helpers";

beforeAll(async () => {
  await priceProduct("balase-rose", 100, "2999.00");
  await priceProduct("tribute-blue", 100, "1999.50", { stock: 3 });
});

async function guestWithCart(items: Array<{ productSlug: string; sizeMl: number; quantity?: number }>) {
  const c = await client();
  for (const i of items) {
    const r = await c.post("/api/v1/cart/items", i);
    if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  }
  return c;
}

const checkoutBody = (extra: Record<string, unknown> = {}) => ({
  email: uniqueEmail("buyer"),
  phone: "+91 98765 43210",
  address,
  paymentMethod: "COD",
  ...extra,
});

describe("checkout & orders", () => {
  it("validates checkout input", async () => {
    const c = await guestWithCart([{ productSlug: "balase-rose", sizeMl: 100 }]);
    const res = await c.post("/api/v1/checkout", { email: "x", phone: "123", paymentMethod: "BITCOIN" });
    expect(res.status).toBe(422);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  it("refuses to check out an empty bag", async () => {
    const c = await client();
    const res = await c.post("/api/v1/checkout", checkoutBody());
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CART_EMPTY");
  });

  it("places a guest COD order with a correct summary and clears the cart", async () => {
    const c = await guestWithCart([{ productSlug: "balase-rose", sizeMl: 100, quantity: 2 }]);
    const res = await c.post("/api/v1/checkout", checkoutBody());
    expect(res.status).toBe(201);
    const { order, payment } = res.body.data;
    expect(order.orderNumber).toMatch(/^AZM-[A-Z0-9]{7}$/);
    expect(order).toMatchObject({ status: "PLACED", paymentMethod: "COD", paymentStatus: "COD_PENDING", isTest: true, phone: "9876543210" });
    expect(order.totals).toEqual({ subtotal: 5998, discount: 0, delivery: null, total: 5998, currency: "INR" });
    expect(order.items[0]).toMatchObject({ productSlug: "balase-rose", sizeMl: 100, unitPrice: 2999, quantity: 2, lineTotal: 5998 });
    expect(payment).toMatchObject({ provider: "cod", status: "COD_PENDING" });
    expect((await c.get("/api/v1/cart")).body.data.items).toHaveLength(0);

    const row = await findRow<OrderRecord>("orders", sql`orderNumber = ${order.orderNumber}`);
    const history = await db.many<OrderStatusHistoryRow>(sql`SELECT * FROM order_status_history WHERE orderId = ${row.id} ORDER BY createdAt ASC, id ASC`);
    expect(row.subtotal.toString()).toBe("5998");
    expect(history.map((h) => h.status)).toEqual(["PENDING_PAYMENT", "PLACED"]);
  });

  it("never claims an online payment succeeded without a provider", async () => {
    const c = await guestWithCart([{ productSlug: "balase-rose", sizeMl: 100 }]);
    const res = await c.post("/api/v1/checkout", checkoutBody({ paymentMethod: "UPI" }));
    expect(res.status).toBe(201);
    expect(res.body.data.order).toMatchObject({ status: "PENDING_PAYMENT", paymentStatus: "NOT_COLLECTED", isTest: true });
    expect(res.body.data.payment).toMatchObject({ provider: "development", status: "NOT_COLLECTED", clientAction: null, isTest: true });
  });

  it("is idempotent with the Idempotency-Key header", async () => {
    const c = await guestWithCart([{ productSlug: "balase-rose", sizeMl: 100 }]);
    const body = checkoutBody();
    const key = `test-${Date.now()}-idem`;
    const first = await c.post("/api/v1/checkout", body, { "Idempotency-Key": key });
    const second = await c.post("/api/v1/checkout", body, { "Idempotency-Key": key });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.replayed).toBe(true);
    expect(second.body.data.order.orderNumber).toBe(first.body.data.order.orderNumber);
    expect(await countRows("orders", sql`idempotencyKey = ${key}`)).toBe(1);
  });

  it("decrements tracked stock atomically and blocks overselling", async () => {
    const a = await guestWithCart([{ productSlug: "tribute-blue", sizeMl: 100, quantity: 2 }]);
    const b = await guestWithCart([{ productSlug: "tribute-blue", sizeMl: 100, quantity: 2 }]);
    expect((await a.post("/api/v1/checkout", checkoutBody())).status).toBe(201);
    const variant = (await db.one<ProductVariantRow>(
      sql`SELECT v.* FROM product_variants v JOIN products p ON p.id = v.productId WHERE v.sizeMl = 100 AND p.slug = 'tribute-blue'`,
    ))!;
    expect((await findRow<InventoryRow>("inventory", sql`variantId = ${variant.id}`)).quantity).toBe(1);
    const oversell = await b.post("/api/v1/checkout", checkoutBody());
    expect(oversell.status).toBe(409);
    expect(oversell.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(await findRow<InventoryRow>("inventory", sql`variantId = ${variant.id}`)).toMatchObject({ quantity: 1 });
  });

  it("enforces coupon usage limits inside the order transaction", async () => {
    const admin = await adminClient();
    await admin.post("/api/v1/admin/coupons", { code: "ONCEONLY", type: "FLAT", value: 500, usageLimit: 1 });
    const a = await guestWithCart([{ productSlug: "balase-rose", sizeMl: 100 }]);
    const b = await guestWithCart([{ productSlug: "balase-rose", sizeMl: 100 }]);
    await a.post("/api/v1/cart/coupon", { code: "ONCEONLY" });
    await b.post("/api/v1/cart/coupon", { code: "ONCEONLY" });
    const first = await a.post("/api/v1/checkout", checkoutBody());
    expect(first.status).toBe(201);
    expect(first.body.data.order.totals).toMatchObject({ subtotal: 2999, discount: 500, total: 2499 });
    const second = await b.post("/api/v1/checkout", checkoutBody());
    expect(second.status).toBe(422);
    expect(second.body.error.code).toBe("COUPON_INVALID");
  });

  it("lets guests look up their order only with matching contact details", async () => {
    const c = await guestWithCart([{ productSlug: "balase-rose", sizeMl: 100 }]);
    const body = checkoutBody();
    const { order } = (await c.post("/api/v1/checkout", body)).body.data;
    const ok = await c.post("/api/v1/orders/lookup", { orderNumber: order.orderNumber, contact: body.email });
    expect(ok.status).toBe(200);
    const byPhone = await c.post("/api/v1/orders/lookup", { orderNumber: order.orderNumber, contact: "9876543210" });
    expect(byPhone.status).toBe(200);
    const wrong = await c.post("/api/v1/orders/lookup", { orderNumber: order.orderNumber, contact: "someone@else.com" });
    expect(wrong.status).toBe(404);
  });

  it("records order history and saved addresses for customers", async () => {
    const { client: c, email } = await registerCustomer();
    await c.post("/api/v1/cart/items", { productSlug: "balase-rose", sizeMl: 100 });
    const res = await c.post("/api/v1/checkout", checkoutBody({ email, saveAddress: true }));
    expect(res.status).toBe(201);
    const history = await c.get("/api/v1/orders");
    expect(history.body.data).toHaveLength(1);
    expect(history.body.meta.pagination.total).toBe(1);
    const addresses = await c.get("/api/v1/customers/me/addresses");
    expect(addresses.body.data[0]).toMatchObject({ pin: "400001", isDefault: true });
    const detail = await c.get(`/api/v1/orders/${res.body.data.order.orderNumber}`);
    expect(detail.status).toBe(200);
    const other = await registerCustomer();
    expect((await other.client.get(`/api/v1/orders/${res.body.data.order.orderNumber}`)).status).toBe(404);
  });

  it("cancels per policy: restocks inventory and releases coupon usage", async () => {
    await priceProduct("tropical-vibes", 100, "1200.00", { stock: 5 });
    const admin = await adminClient();
    await admin.post("/api/v1/admin/coupons", { code: "CANCELME", type: "FLAT", value: 100, usageLimit: 5 });
    const c = await guestWithCart([{ productSlug: "tropical-vibes", sizeMl: 100, quantity: 2 }]);
    await c.post("/api/v1/cart/coupon", { code: "CANCELME" });
    const body = checkoutBody();
    const { order } = (await c.post("/api/v1/checkout", body)).body.data;
    const coupon = await findRow<CouponRow>("coupons", sql`code = 'CANCELME'`);
    expect(coupon.usedCount).toBe(1);

    expect((await c.post(`/api/v1/orders/${order.orderNumber}/cancel`, { reason: "Changed my mind", contact: "wrong@x.com" })).status).toBe(404);
    const res = await c.post(`/api/v1/orders/${order.orderNumber}/cancel`, { reason: "Changed my mind", contact: body.email });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "CANCELLED", paymentStatus: "CANCELLED" });
    const inv = (await db.one<InventoryRow>(sql`
      SELECT i.* FROM inventory i JOIN product_variants v ON v.id = i.variantId JOIN products p ON p.id = v.productId
      WHERE v.sizeMl = 100 AND p.slug = 'tropical-vibes'`))!;
    expect(inv.quantity).toBe(5);
    expect((await findRow<CouponRow>("coupons", sql`code = 'CANCELME'`)).usedCount).toBe(0);
  });

  it("refuses customer cancellation once shipped", async () => {
    const c = await guestWithCart([{ productSlug: "balase-rose", sizeMl: 100 }]);
    const body = checkoutBody();
    const { order } = (await c.post("/api/v1/checkout", body)).body.data;
    const admin = await adminClient();
    const shipment = await admin.post(`/api/v1/admin/orders/${order.id}/shipments`, { courier: "Test Courier", awb: `AWB${Date.now()}` });
    expect(shipment.status).toBe(201);
    const res = await c.post(`/api/v1/orders/${order.orderNumber}/cancel`, { contact: body.email });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NOT_CANCELLABLE");
  });

  it("validates admin status transitions", async () => {
    const c = await guestWithCart([{ productSlug: "balase-rose", sizeMl: 100 }]);
    const { order } = (await c.post("/api/v1/checkout", checkoutBody())).body.data;
    const admin = await adminClient();
    const invalid = await admin.patch(`/api/v1/admin/orders/${order.id}/status`, { status: "DELIVERED" });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe("INVALID_TRANSITION");
    const ok = await admin.patch(`/api/v1/admin/orders/${order.id}/status`, { status: "CONFIRMED", note: "Checked" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("CONFIRMED");
  });
});
