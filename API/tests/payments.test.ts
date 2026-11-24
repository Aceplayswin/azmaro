import { createHmac } from "node:crypto";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Enable the Razorpay adapter for this file (before any app module is imported).
vi.hoisted(() => {
  process.env.PAYMENT_PROVIDER = "razorpay";
  process.env.RAZORPAY_KEY_ID = "rzp_test_azmaro";
  process.env.RAZORPAY_KEY_SECRET = "test_key_secret";
});

import type { OrderRecord, PaymentRow } from "../src/db";
import { address, client, countRows, db, findRow, getApp, priceProduct, sql, uniqueEmail } from "./helpers";

const orderByNumber = (orderNumber: string) => findRow<OrderRecord>("orders", sql`orderNumber = ${orderNumber}`);

const WEBHOOK_SECRET = "test_razorpay_webhook_secret";
let counter = 0;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  await priceProduct("cullinan-diamond-iris", 150, "5400.00");
  // Network is mocked: no request ever reaches Razorpay.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://api.razorpay.com/v1/orders") {
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: `order_TEST${++counter}`, status: "created", amount: body.amount }), { status: 200 });
    }
    return realFetch(input, init);
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

async function placeUpiOrder() {
  const c = await client();
  await c.post("/api/v1/cart/items", { productSlug: "cullinan-diamond-iris", sizeMl: 150 });
  const res = await c.post("/api/v1/checkout", { email: uniqueEmail("pay"), phone: "9876543210", address, paymentMethod: "UPI" });
  expect(res.status).toBe(201);
  return res.body.data;
}

const sign = (raw: string) => createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");

async function webhook(payload: object, eventId: string, signature?: string) {
  const raw = JSON.stringify(payload);
  return supertest(await getApp())
    .post("/api/v1/payments/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Event-Id", eventId)
    .set("X-Razorpay-Signature", signature ?? sign(raw))
    .send(raw);
}

const captured = (orderId: string, amount: number, paymentId = `pay_${orderId}`) => ({
  event: "payment.captured",
  payload: { payment: { entity: { id: paymentId, order_id: orderId, status: "captured", amount } } },
});

describe("payments (Razorpay adapter)", () => {
  it("creates a Razorpay order and returns a checkout action instead of marking anything paid", async () => {
    const { order, payment } = await placeUpiOrder();
    expect(order).toMatchObject({ status: "PENDING_PAYMENT", paymentStatus: "PENDING" });
    expect(payment.clientAction).toMatchObject({ type: "razorpay_checkout", keyId: "rzp_test_azmaro", amountPaise: 540000, currency: "INR" });
    expect(payment.clientAction.providerOrderId).toMatch(/^order_TEST/);
    const row = (await db.one<PaymentRow>(sql`SELECT pay.* FROM payments pay JOIN orders o ON o.id = pay.orderId WHERE o.orderNumber = ${order.orderNumber}`))!;
    expect(row).toMatchObject({ provider: "razorpay", status: "PENDING", isTest: true });
  });

  it("rejects webhooks with a missing or invalid signature", async () => {
    const { payment } = await placeUpiOrder();
    const payload = captured(payment.clientAction.providerOrderId, 540000);
    expect((await webhook(payload, "evt_bad_1", "deadbeef")).status).toBe(401);
    const res = await supertest(await getApp()).post("/api/v1/payments/webhooks/razorpay").send(payload);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_SIGNATURE");
  });

  it("marks the order paid from a verified webhook and ignores replays", async () => {
    const { order, payment } = await placeUpiOrder();
    const payload = captured(payment.clientAction.providerOrderId, 540000);
    const first = await webhook(payload, `evt_${order.orderNumber}`);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ duplicate: false, applied: true });
    const row = await orderByNumber(order.orderNumber);
    expect(row).toMatchObject({ status: "PLACED", paymentStatus: "PAID" });

    const replay = await webhook(payload, `evt_${order.orderNumber}`);
    expect(replay.body.data).toMatchObject({ duplicate: true, applied: false });
    expect(await countRows("payment_webhook_events", sql`eventId = ${`evt_${order.orderNumber}`}`)).toBe(1);
  });

  it("does not downgrade a paid payment on a late failure event", async () => {
    const { order, payment } = await placeUpiOrder();
    const oid = payment.clientAction.providerOrderId;
    await webhook(captured(oid, 540000), `evt_cap_${oid}`);
    const failed = await webhook({ event: "payment.failed", payload: { payment: { entity: { id: `pay_${oid}`, order_id: oid, status: "failed", amount: 540000 } } } }, `evt_fail_${oid}`);
    expect(failed.body.data.applied).toBe(false);
    expect((await orderByNumber(order.orderNumber)).paymentStatus).toBe("PAID");
  });

  it("refuses to apply a webhook whose amount does not match", async () => {
    const { order, payment } = await placeUpiOrder();
    const res = await webhook(captured(payment.clientAction.providerOrderId, 100), `evt_amount_${order.orderNumber}`);
    expect(res.body.data.applied).toBe(false);
    expect(res.body.data.error).toMatch(/Amount mismatch/);
    expect((await orderByNumber(order.orderNumber)).paymentStatus).toBe("PENDING");
  });

  it("verifies the Razorpay Checkout signature before marking paid", async () => {
    const { order, payment } = await placeUpiOrder();
    const oid = payment.clientAction.providerOrderId;
    const c = await client();
    const bad = await c.post("/api/v1/payments/razorpay/verify", {
      orderNumber: order.orderNumber,
      razorpay_order_id: oid,
      razorpay_payment_id: "pay_forged123",
      razorpay_signature: "0".repeat(64),
    });
    expect(bad.status).toBe(400);
    expect((await orderByNumber(order.orderNumber)).paymentStatus).toBe("PENDING");

    const signature = createHmac("sha256", "test_key_secret").update(`${oid}|pay_genuine123`).digest("hex");
    const ok = await c.post("/api/v1/payments/razorpay/verify", {
      orderNumber: order.orderNumber,
      razorpay_order_id: oid,
      razorpay_payment_id: "pay_genuine123",
      razorpay_signature: signature,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("PAID");
    expect((await orderByNumber(order.orderNumber)).status).toBe("PLACED");
  });

  it("flags a refund when a cancelled order is later paid", async () => {
    const { order, payment } = await placeUpiOrder();
    const c = await client();
    const row = await orderByNumber(order.orderNumber);
    const cancel = await c.post(`/api/v1/orders/${order.orderNumber}/cancel`, { contact: row.email });
    expect(cancel.status).toBe(200);
    await webhook(captured(payment.clientAction.providerOrderId, 540000), `evt_late_${order.orderNumber}`);
    const after = await orderByNumber(order.orderNumber);
    expect(after).toMatchObject({ status: "CANCELLED", paymentStatus: "REFUND_PENDING" });
  });
});
