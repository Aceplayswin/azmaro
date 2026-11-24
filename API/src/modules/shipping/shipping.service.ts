import {
  db,
  insert,
  sql,
  transaction,
  update,
  SHIPMENT_STATUSES,
  type Db,
  type EventSource,
  type OrderItemRow,
  type OrderRecord,
  type OrderStatus,
  type PaymentRow,
  type ShipmentEventRow,
  type ShipmentRow,
  type ShipmentStatus,
} from "../../db";
import { getShippingProvider } from "../../integrations/shipping";
import { mapShiprocketStatus } from "../../integrations/shipping/shiprocket";
import { conflict, notFound, unprocessable } from "../../utils/errors";
import { money, toAmount } from "../../utils/money";
import { deliveryFeeFor } from "../checkout/quote.service";
import { findOrder, withEvents } from "../orders/order.dto";
import { findOrderForCustomer, recordStatus } from "../orders/order.service";
import { getSetting } from "../settings/settings.service";

/**
 * Shipping & tracking. Delivery estimates and scan events come ONLY from the
 * courier (or are recorded explicitly by staff with source=ADMIN). Nothing is
 * projected or invented.
 */

export async function checkServiceability(pin: string, cod = false) {
  const { defaultWeightGrams } = await getSetting("shipping");
  const result = await getShippingProvider().checkServiceability(pin, { cod, weightGrams: defaultWeightGrams });
  const s = await getSetting("shipping");
  return {
    ...result,
    deliveryCharge: {
      flatFee: s.flatFeeInr,
      freeAbove: s.freeAboveInr,
      status: s.flatFeeInr === null ? "TO_BE_CONFIRMED" : "CONFIGURED",
    },
  };
}

export async function quoteDelivery(subtotalInr: number) {
  const { fee, status } = await deliveryFeeFor(money(subtotalInr));
  return { fee: toAmount(fee), status };
}

const SHIPPED_FROM: OrderStatus[] = ["PLACED", "CONFIRMED", "PROCESSING"];

const findShipment = (ex: Db, condition: ReturnType<typeof sql>) => ex.one<ShipmentRow>(sql`SELECT * FROM shipments WHERE ${condition}`);

async function shipmentWithEvents(ex: Db, shipmentId: string) {
  const [s] = await withEvents([(await findShipment(ex, sql`id = ${shipmentId}`))!], ex);
  return s!;
}

async function syncOrderStatus(tx: Db, orderId: string, shipmentStatus: ShipmentStatus, actor: string) {
  const order = (await tx.one<OrderRecord>(sql`SELECT * FROM orders WHERE id = ${orderId}`))!;
  const payments = await tx.many<PaymentRow>(sql`SELECT * FROM payments WHERE orderId = ${orderId}`);
  const record = (status: OrderStatus, note: string) => recordStatus(tx, orderId, status, actor, note);
  if (["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(shipmentStatus) && SHIPPED_FROM.includes(order.status)) {
    await record("SHIPPED", "Shipment picked up by courier.");
  } else if (shipmentStatus === "DELIVERED" && order.status !== "DELIVERED" && order.status !== "CANCELLED") {
    await record("DELIVERED", "Delivered (confirmed by courier).");
    // Cash on delivery is collected by the courier at delivery.
    const cod = payments.find((p) => p.method === "COD" && p.status === "COD_PENDING");
    if (cod) {
      await update(tx, "payments", { status: "PAID", providerStatus: "collected_on_delivery" }, sql`id = ${cod.id}`);
      await update(tx, "orders", { paymentStatus: "PAID" }, sql`id = ${orderId}`);
    }
  } else if (shipmentStatus === "RETURN_TO_ORIGIN" && order.status === "SHIPPED") {
    await record("RETURNED", "Returned to origin by courier.");
  }
}

/** Book a shipment: via the courier integration, or manually with courier + AWB supplied by staff. */
export async function bookShipment(orderId: string, manual: { courier?: string; awb?: string } | undefined, actor: string) {
  const order = await db.one<OrderRecord>(sql`SELECT * FROM orders WHERE id = ${orderId}`);
  if (!order) throw notFound("Order");
  if (!["PLACED", "CONFIRMED", "PROCESSING"].includes(order.status))
    throw unprocessable(`Orders in status ${order.status} cannot be shipped.`, undefined, "INVALID_TRANSITION");
  const [items, shipments] = await Promise.all([
    db.many<OrderItemRow>(sql`SELECT * FROM order_items WHERE orderId = ${orderId} ORDER BY id ASC`),
    db.many<ShipmentRow>(sql`SELECT * FROM shipments WHERE orderId = ${orderId}`),
  ]);
  if (shipments.some((s) => !["CANCELLED", "RETURN_TO_ORIGIN"].includes(s.status)))
    throw conflict("This order already has an active shipment.", undefined, "SHIPMENT_EXISTS");

  const provider = getShippingProvider();
  let data: { provider: string; courier: string | null; awb: string | null; status: ShipmentStatus; labelUrl: string | null; providerShipmentId: string | null };

  if (manual?.courier && manual.awb) {
    data = { provider: "manual", courier: manual.courier, awb: manual.awb, status: "BOOKED", labelUrl: null, providerShipmentId: null };
  } else {
    const { defaultWeightGrams } = await getSetting("shipping");
    const result = await provider.createShipment({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      customer: { name: order.shipName, email: order.email, phone: order.shipPhone },
      address: { line1: order.shipLine1, line2: order.shipLine2, landmark: order.shipLandmark, city: order.shipCity, state: order.shipState, pin: order.shipPin },
      items: items.map((i) => ({ name: `${i.brandName} ${i.productName} ${i.sizeMl}ml`, sku: i.sku, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
      subtotal: Number(order.subtotal),
      paymentMethod: order.paymentMethod === "COD" ? "COD" : "PREPAID",
      weightGrams: defaultWeightGrams,
    });
    data = { provider: provider.name, ...result };
  }

  return transaction(async (tx) => {
    const shipmentId = await insert(tx, "shipments", { orderId, ...data });
    if (data.awb) {
      await insert(tx, "shipment_events", {
        shipmentId,
        status: "BOOKED",
        description: `Shipment booked${data.courier ? ` with ${data.courier}` : ""} (AWB ${data.awb}).`,
        occurredAt: new Date(),
        source: data.provider === "manual" ? "ADMIN" : "COURIER",
      });
    }
    if (order.status === "PLACED" || order.status === "CONFIRMED") await recordStatus(tx, orderId, "PROCESSING", actor, "Shipment booked.");
    return shipmentWithEvents(tx, shipmentId);
  });
}

export async function updateShipment(shipmentId: string, patch: { courier?: string; awb?: string; labelUrl?: string | null }) {
  const shipment = await findShipment(db, sql`id = ${shipmentId}`);
  if (!shipment) throw notFound("Shipment");
  await update(db, "shipments", patch, sql`id = ${shipmentId}`);
  return shipmentWithEvents(db, shipmentId);
}

/** Record a shipment event (from the courier or staff) and propagate status. De-duplicated by externalId. */
export async function addShipmentEvent(
  shipmentId: string,
  e: { status: ShipmentStatus; description: string; location?: string | null; occurredAt?: Date; externalId?: string | null },
  source: EventSource,
  actor: string,
) {
  const shipment = await findShipment(db, sql`id = ${shipmentId}`);
  if (!shipment) throw notFound("Shipment");
  return transaction(async (tx) => {
    if (e.externalId) {
      const dup = await tx.one<ShipmentEventRow>(sql`SELECT * FROM shipment_events WHERE shipmentId = ${shipmentId} AND externalId = ${e.externalId}`);
      if (dup) return { event: dup, duplicate: true };
    }
    const eventId = await insert(tx, "shipment_events", {
      shipmentId,
      status: e.status,
      description: e.description,
      location: e.location ?? null,
      occurredAt: e.occurredAt ?? new Date(),
      source,
      externalId: e.externalId ?? null,
    });
    const event = (await tx.one<ShipmentEventRow>(sql`SELECT * FROM shipment_events WHERE id = ${eventId}`))!;
    await update(tx, "shipments", { status: e.status }, sql`id = ${shipmentId}`);
    await syncOrderStatus(tx, shipment.orderId, e.status, actor);
    return { event, duplicate: false };
  });
}

/** Pull new scan events from the courier for a shipment (no-op without a configured courier). */
export async function refreshFromCourier(shipmentId: string) {
  const shipment = await findShipment(db, sql`id = ${shipmentId}`);
  const provider = getShippingProvider();
  if (!shipment?.awb || shipment.provider !== provider.name || provider.isTest) return 0;
  const tracking = await provider.track(shipment.awb);
  let added = 0;
  for (const ev of tracking.events) {
    const r = await addShipmentEvent(shipmentId, ev, "COURIER", "courier");
    if (!r.duplicate) added++;
  }
  return added;
}

/** Courier status webhook (already authenticated by the caller). */
export async function handleCourierWebhook(payload: {
  awb: string;
  status: string;
  description?: string;
  location?: string;
  occurredAt?: string;
  eventId?: string;
}) {
  const shipment = await findShipment(db, sql`awb = ${payload.awb}`);
  if (!shipment) throw notFound("Shipment");
  const status = (mapShiprocketStatus(payload.status) ?? (payload.status.toUpperCase() as ShipmentStatus)) as ShipmentStatus;
  if (!(SHIPMENT_STATUSES as readonly string[]).includes(status)) throw unprocessable(`Unknown shipment status "${payload.status}".`, undefined, "UNKNOWN_STATUS");
  const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
  return addShipmentEvent(
    shipment.id,
    {
      status,
      description: payload.description?.slice(0, 500) || payload.status,
      location: payload.location?.slice(0, 160) ?? null,
      occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
      externalId: (payload.eventId ?? `${payload.status}|${payload.occurredAt ?? ""}`).slice(0, 120),
    },
    "COURIER",
    "courier",
  );
}

/** Public tracking view – order number + email/phone (or the signed-in owner). */
export async function trackOrder(orderNumber: string, who: { userId?: string; contact?: string }) {
  const order = await findOrderForCustomer(orderNumber, who);
  for (const s of order.shipments) {
    try {
      await refreshFromCourier(s.id);
    } catch {
      /* courier unavailable – show stored events only */
    }
  }
  const fresh = (await findOrder(sql`id = ${order.id}`))!;
  return {
    orderNumber: fresh.orderNumber,
    orderStatus: fresh.status,
    paymentStatus: fresh.paymentStatus,
    isTest: fresh.isTest,
    placedAt: fresh.createdAt,
    shipments: fresh.shipments.map((s) => ({
      courier: s.courier,
      awb: s.awb,
      status: s.status,
      events: s.events.map((e) => ({
        status: e.status,
        description: e.description,
        location: e.location,
        occurredAt: e.occurredAt,
        source: e.source,
      })),
    })),
    timeline: fresh.statusHistory.map((h) => ({ status: h.status, note: h.note, at: h.createdAt })),
    message: fresh.shipments.length
      ? null
      : "Courier and AWB will appear here once the shipment is booked.",
  };
}
