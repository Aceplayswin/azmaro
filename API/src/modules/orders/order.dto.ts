import { db, insert, sql, type Db, type OrderStatus, type OrderItemRow, type OrderRecord, type OrderStatusHistoryRow, type PaymentRow, type ShipmentEventRow, type ShipmentRow, type Sql } from "../../db";
import { toAmount } from "../../utils/money";

export type ShipmentWithEvents = ShipmentRow & { events: ShipmentEventRow[] };

/** An order with items, payments (newest first), shipments + events and status history (oldest first). */
export type OrderRow = OrderRecord & {
  items: OrderItemRow[];
  payments: PaymentRow[];
  shipments: ShipmentWithEvents[];
  statusHistory: OrderStatusHistoryRow[];
};

export type OrderCustomer = { id: string; name: string; email: string };

const byKey = <T, K extends keyof T>(rows: T[], key: K) => {
  const map = new Map<T[K], T[]>();
  for (const r of rows) map.set(r[key], [...(map.get(r[key]) ?? []), r]);
  return map;
};

/** Attach shipment events (oldest first). */
export async function withEvents(shipments: ShipmentRow[], ex: Db = db): Promise<ShipmentWithEvents[]> {
  const events = byKey(
    await ex.many<ShipmentEventRow>(sql`SELECT * FROM shipment_events WHERE shipmentId IN (${shipments.map((s) => s.id)}) ORDER BY occurredAt ASC, createdAt ASC, id ASC`),
    "shipmentId",
  );
  return shipments.map((s) => ({ ...s, events: events.get(s.id) ?? [] }));
}

/** Load the relations of order rows (keeps the given order). */
export async function loadOrders(orders: OrderRecord[], ex: Db = db): Promise<OrderRow[]> {
  if (!orders.length) return [];
  const ids = orders.map((o) => o.id);
  const [items, payments, shipments, history] = await Promise.all([
    ex.many<OrderItemRow>(sql`SELECT * FROM order_items WHERE orderId IN (${ids}) ORDER BY id ASC`),
    ex.many<PaymentRow>(sql`SELECT * FROM payments WHERE orderId IN (${ids}) ORDER BY createdAt DESC, id DESC`),
    ex.many<ShipmentRow>(sql`SELECT * FROM shipments WHERE orderId IN (${ids}) ORDER BY createdAt ASC, id ASC`),
    ex.many<OrderStatusHistoryRow>(sql`SELECT * FROM order_status_history WHERE orderId IN (${ids}) ORDER BY createdAt ASC, id ASC`),
  ]);
  const itemsBy = byKey(items, "orderId");
  const paymentsBy = byKey(payments, "orderId");
  const shipmentsBy = byKey(await withEvents(shipments, ex), "orderId");
  const historyBy = byKey(history, "orderId");
  return orders.map((o) => ({
    ...o,
    items: itemsBy.get(o.id) ?? [],
    payments: paymentsBy.get(o.id) ?? [],
    shipments: shipmentsBy.get(o.id) ?? [],
    statusHistory: historyBy.get(o.id) ?? [],
  }));
}

export async function loadOrder(order: OrderRecord, ex: Db = db): Promise<OrderRow> {
  return (await loadOrders([order], ex))[0]!;
}

/** One full order by a condition on `orders` (e.g. sql`id = ${id}`), or null. */
export async function findOrder(condition: Sql, ex: Db = db): Promise<OrderRow | null> {
  const row = await ex.one<OrderRecord>(sql`SELECT * FROM orders WHERE ${condition}`);
  return row ? loadOrder(row, ex) : null;
}

/** Append an entry to an order's status history. */
export const addStatusHistory = (ex: Db, orderId: string, status: OrderStatus, actor: string, note?: string | null) =>
  insert(ex, "order_status_history", { orderId, status, actor, note: note ?? null });

/** Attach the customer account (id, name, email) for admin views. */
export async function withCustomers<O extends OrderRecord>(orders: O[]): Promise<Array<O & { user: OrderCustomer | null }>> {
  const users = await db.many<OrderCustomer>(sql`SELECT id, name, email FROM users WHERE id IN (${orders.flatMap((o) => (o.userId ? [o.userId] : []))})`);
  const byId = new Map(users.map((u) => [u.id, u]));
  return orders.map((o) => ({ ...o, user: o.userId ? (byId.get(o.userId) ?? null) : null }));
}

/** Customer-facing order representation (no internal provider ids / raw payloads). */
export function toOrderDto(o: OrderRow) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    isTest: o.isTest,
    email: o.email,
    phone: o.phone,
    items: o.items.map((i) => ({
      productSlug: i.productSlug,
      productName: i.productName,
      brandName: i.brandName,
      sizeMl: i.sizeMl,
      sku: i.sku,
      unitPrice: toAmount(i.unitPrice)!,
      quantity: i.quantity,
      lineTotal: toAmount(i.lineTotal)!,
    })),
    totals: {
      subtotal: toAmount(o.subtotal)!,
      discount: toAmount(o.discountTotal)!,
      delivery: toAmount(o.deliveryFee),
      total: toAmount(o.total)!,
      currency: o.currency,
    },
    couponCode: o.couponCode,
    shippingAddress: {
      fullName: o.shipName,
      phone: o.shipPhone,
      line1: o.shipLine1,
      line2: o.shipLine2,
      landmark: o.shipLandmark,
      city: o.shipCity,
      state: o.shipState,
      pin: o.shipPin,
    },
    customerNote: o.customerNote,
    shipments: o.shipments.map((s) => ({
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
    statusHistory: o.statusHistory.map((h) => ({ status: h.status, note: h.note, at: h.createdAt })),
    cancelledAt: o.cancelledAt,
    cancelReason: o.cancelReason,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export type OrderDto = ReturnType<typeof toOrderDto>;

/** Admin view adds payment attempts and internal references. */
export function toAdminOrderDto(o: OrderRow & { user?: OrderCustomer | null }) {
  return {
    ...toOrderDto(o),
    userId: o.userId,
    customer: o.user ? { id: o.user.id, name: o.user.name, email: o.user.email } : null,
    idempotencyKey: o.idempotencyKey,
    payments: o.payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      method: p.method,
      status: p.status,
      amount: toAmount(p.amount),
      providerOrderId: p.providerOrderId,
      providerPaymentId: p.providerPaymentId,
      providerStatus: p.providerStatus,
      failureReason: p.failureReason,
      isTest: p.isTest,
      createdAt: p.createdAt,
    })),
    shipments: o.shipments.map((s) => ({
      id: s.id,
      provider: s.provider,
      courier: s.courier,
      awb: s.awb,
      status: s.status,
      labelUrl: s.labelUrl,
      providerShipmentId: s.providerShipmentId,
      events: s.events,
    })),
    statusHistory: o.statusHistory,
  };
}
