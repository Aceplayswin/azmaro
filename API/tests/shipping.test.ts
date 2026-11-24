import supertest from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { OrderRecord } from "../src/db";
import { address, adminClient, client, findRow, getApp, priceProduct, sql, uniqueEmail } from "./helpers";

const orderById = (id: string) => findRow<OrderRecord>("orders", sql`id = ${id}`);

beforeAll(async () => {
  await priceProduct("pinaace", 100, "1499.00");
});

async function codOrder() {
  const c = await client();
  await c.post("/api/v1/cart/items", { productSlug: "pinaace", sizeMl: 100 });
  const email = uniqueEmail("ship");
  const res = await c.post("/api/v1/checkout", { email, phone: "9876543210", address, paymentMethod: "COD" });
  return { order: res.body.data.order, email, c };
}

const courier = async (body: object, token = "test_courier_webhook_secret") =>
  supertest(await getApp()).post("/api/v1/shipping/webhooks/courier").set("X-Courier-Token", token).send(body);

describe("shipping & tracking", () => {
  it("reports serviceability honestly when no courier is connected", async () => {
    const c = await client();
    const res = await c.post("/api/v1/shipping/serviceability", { pin: "560001" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "UNAVAILABLE", isTest: true, estimate: null, courier: null, courierRate: null });
    expect((await c.post("/api/v1/shipping/serviceability", { pin: "12" })).status).toBe(422);
  });

  it("requires courier + AWB for manual booking when no courier API is connected", async () => {
    const { order } = await codOrder();
    const admin = await adminClient();
    const auto = await admin.post(`/api/v1/admin/orders/${order.id}/shipments`, {});
    expect(auto.status).toBe(503);
    expect(auto.body.error.code).toBe("COURIER_NOT_CONFIGURED");
    expect((await admin.post(`/api/v1/admin/orders/${order.id}/shipments`, { courier: "Delhivery" })).status).toBe(422);
  });

  it("tracks courier updates end-to-end and settles COD on delivery", async () => {
    const { order, email } = await codOrder();
    const admin = await adminClient();
    const awb = `AWB${Date.now()}`;
    const booked = await admin.post(`/api/v1/admin/orders/${order.id}/shipments`, { courier: "Delhivery", awb });
    expect(booked.status).toBe(201);

    expect((await courier({ awb, status: "IN_TRANSIT" }, "wrong-token")).status).toBe(401);
    const transit = await courier({ awb, status: "In Transit", description: "Departed Mumbai hub", location: "Mumbai", eventId: "e1" });
    expect(transit.status).toBe(200);
    expect((await courier({ awb, status: "In Transit", eventId: "e1" })).body.data.duplicate).toBe(true);

    let row = await orderById(order.id);
    expect(row.status).toBe("SHIPPED");

    await courier({ awb, status: "DELIVERED", description: "Delivered to customer", eventId: "e2" });
    row = await orderById(order.id);
    expect(row).toMatchObject({ status: "DELIVERED", paymentStatus: "PAID" });

    const c = await client();
    const track = await c.post("/api/v1/tracking/lookup", { orderNumber: order.orderNumber, contact: email });
    expect(track.status).toBe(200);
    expect(track.body.data.shipments[0]).toMatchObject({ courier: "Delhivery", awb, status: "DELIVERED" });
    expect(track.body.data.shipments[0].events.map((e: { status: string }) => e.status)).toEqual(["BOOKED", "IN_TRANSIT", "DELIVERED"]);
    expect((await c.post("/api/v1/tracking/lookup", { orderNumber: order.orderNumber, contact: "x@y.com" })).status).toBe(404);
  });

  it("only shows events that were actually recorded", async () => {
    const { order, email } = await codOrder();
    const c = await client();
    const res = await c.post("/api/v1/tracking/lookup", { orderNumber: order.orderNumber, contact: email });
    expect(res.body.data.shipments).toEqual([]);
    expect(res.body.data.message).toMatch(/once the shipment is booked/);
  });

  it("lets staff record confirmed events for manual shipments", async () => {
    const { order } = await codOrder();
    const admin = await adminClient();
    const shipment = (await admin.post(`/api/v1/admin/orders/${order.id}/shipments`, { courier: "Blue Dart", awb: `BD${Date.now()}` })).body.data;
    const ev = await admin.post(`/api/v1/admin/shipments/${shipment.id}/events`, { status: "PICKED_UP", description: "Picked up from warehouse" });
    expect(ev.status).toBe(201);
    expect(ev.body.data.source).toBe("ADMIN");
    expect((await orderById(order.id)).status).toBe("SHIPPED");
  });
});
