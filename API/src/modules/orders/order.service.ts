import { env } from "../../config/env";
import { db, insert, insertMany, raw, sql, transaction, update, type CouponRedemptionRow, type CouponRow, type Db, type OrderRecord, type OrderStatus, type PaymentMethod } from "../../db";
import { sendEmail } from "../../integrations/messaging";
import { getShippingProvider } from "../../integrations/shipping";
import { orderNumber as newOrderNumber } from "../../utils/crypto";
import { AppError, conflict, notFound, unprocessable } from "../../utils/errors";
import { money, round2, toAmount } from "../../utils/money";
import type { AddressInput } from "../../validators/common";
import { variantAvailability } from "../catalogue/catalogue.mapper";
import { buildQuote, evaluateCoupon, quoteVariantsByIds, type QuoteLineInput } from "../checkout/quote.service";
import { initiatePayment } from "../payments/payment.service";
import { getSetting } from "../settings/settings.service";
import { addStatusHistory, findOrder, loadOrders, type OrderRow } from "./order.dto";

export interface PlaceOrderInput {
  lines: Array<{ variantId: string; quantity: number }>;
  email: string;
  phone: string;
  address: AddressInput;
  paymentMethod: PaymentMethod;
  couponCode?: string | null;
  note?: string | null;
  userId?: string | null;
  idempotencyKey?: string | null;
}

/**
 * Creates an order atomically:
 *  1. prices every line from the database (client prices are never trusted)
 *  2. inside one transaction: decrements tracked stock with conditional updates,
 *     redeems the coupon within its usage limit, snapshots items + address
 *  3. after commit, starts the payment via the provider adapter
 * Retrying with the same Idempotency-Key returns the original order.
 */
export async function placeOrder(input: PlaceOrderInput) {
  if (input.idempotencyKey) {
    const existing = await findOrder(sql`idempotencyKey = ${input.idempotencyKey}`);
    if (existing) return { order: existing, payment: null, replayed: true };
  }
  if (!input.lines.length) throw unprocessable("Your bag is empty.", undefined, "CART_EMPTY");

  const { maxQuantityPerLine } = await getSetting("orders");
  const variants = await quoteVariantsByIds(input.lines.map((l) => l.variantId));
  const lines: QuoteLineInput[] = input.lines.map((l) => {
    const variant = variants.find((v) => v.id === l.variantId);
    if (!variant || !variant.product.isPublished) throw unprocessable("An item in your bag is no longer available.", { variantId: l.variantId }, "ITEM_UNAVAILABLE");
    if (l.quantity < 1 || l.quantity > maxQuantityPerLine) throw unprocessable(`You can order up to ${maxQuantityPerLine} of each item.`);
    return { variant, quantity: l.quantity };
  });
  const problems = lines
    .map((l) => ({ l, a: variantAvailability(l.variant) }))
    .filter(({ a }) => !a.isPurchasable)
    .map(({ l, a }) => ({ variantId: l.variant.id, product: l.variant.product.name, sizeMl: l.variant.sizeMl, reason: a.reason }));
  if (problems.length) throw conflict(`${problems[0]!.product} can't be ordered: ${problems[0]!.reason}`, problems, "ITEMS_NOT_PURCHASABLE");

  const quote = await buildQuote({ lines, couponCode: input.couponCode, email: input.email });
  if (input.couponCode && !quote.coupon?.valid) throw unprocessable(quote.coupon?.message ?? "This code isn't valid.", undefined, "COUPON_INVALID");

  // Payment method rules
  const paymentSettings = await getSetting("payments");
  if (input.paymentMethod === "COD") {
    if (!paymentSettings.codEnabled) throw unprocessable("Cash on delivery is not available at the moment.", undefined, "COD_UNAVAILABLE");
    if (paymentSettings.codMaxOrderInr !== null && quote.total.greaterThan(paymentSettings.codMaxOrderInr))
      throw unprocessable(`Cash on delivery is available for orders up to ₹${paymentSettings.codMaxOrderInr}.`, undefined, "COD_LIMIT");
  } else if (!paymentSettings.onlineMethods.includes(input.paymentMethod)) {
    throw unprocessable("This payment method is not available.", undefined, "PAYMENT_METHOD_UNAVAILABLE");
  }

  // Courier serviceability: only blocks when a real courier says "no".
  const { defaultWeightGrams } = await getSetting("shipping");
  const serviceability = await getShippingProvider().checkServiceability(input.address.pin, {
    cod: input.paymentMethod === "COD",
    weightGrams: defaultWeightGrams,
  });
  if (serviceability.status === "UNSERVICEABLE") throw unprocessable(serviceability.message, undefined, "PIN_UNSERVICEABLE");
  if (input.paymentMethod === "COD" && serviceability.codAvailable === false)
    throw unprocessable("Cash on delivery is not available for this PIN code.", undefined, "COD_UNSERVICEABLE");

  const isTest = env.INTEGRATION_MODE === "demo";

  const orderId = await transaction(async (tx) => {
    for (const l of lines) {
      const inv = l.variant.inventory;
      if (inv && inv.quantity !== null) {
        const { affectedRows } = await tx.run(
          sql`UPDATE inventory SET quantity = quantity - ${l.quantity} WHERE id = ${inv.id} AND quantity >= ${l.quantity}`,
        );
        if (affectedRows !== 1) throw conflict(`${l.variant.product.name} (${l.variant.sizeMl} ml) is no longer in stock in that quantity.`, { variantId: l.variant.id }, "INSUFFICIENT_STOCK");
      }
    }

    let couponId: string | null = null;
    if (quote.coupon?.valid) {
      // Re-validate inside the transaction and claim a use atomically.
      const fresh = await evaluateCoupon(quote.coupon.code, quote.subtotal, input.email, tx);
      if (!fresh.valid || !fresh.discount.equals(quote.discount)) throw unprocessable(fresh.message, undefined, "COUPON_INVALID");
      const coupon = (await tx.one<CouponRow>(sql`SELECT * FROM coupons WHERE code = ${fresh.code}`))!;
      const { affectedRows } = await tx.run(sql`
        UPDATE coupons SET usedCount = usedCount + 1
        WHERE id = ${coupon.id} ${coupon.usageLimit !== null ? sql`AND usedCount < ${coupon.usageLimit}` : raw("")}`);
      if (affectedRows !== 1) throw unprocessable("This code has reached its usage limit.", undefined, "COUPON_INVALID");
      couponId = coupon.id;
    }

    let number = newOrderNumber();
    while (await tx.one(sql`SELECT id FROM orders WHERE orderNumber = ${number}`)) number = newOrderNumber();

    const id = await insert(tx, "orders", {
      orderNumber: number,
      idempotencyKey: input.idempotencyKey ?? null,
      userId: input.userId ?? null,
      email: input.email,
      phone: input.phone,
      status: "PENDING_PAYMENT",
      paymentMethod: input.paymentMethod,
      paymentStatus: "PENDING",
      subtotal: quote.subtotal,
      discountTotal: quote.discount,
      deliveryFee: quote.delivery,
      total: quote.total,
      couponCode: quote.coupon?.valid ? quote.coupon.code : null,
      shipName: input.address.fullName,
      shipPhone: input.address.phone,
      shipLine1: input.address.line1,
      shipLine2: input.address.line2 ?? null,
      shipLandmark: input.address.landmark ?? null,
      shipCity: input.address.city,
      shipState: input.address.state,
      shipPin: input.address.pin,
      customerNote: input.note ?? null,
      isTest,
    });
    await insertMany(
      tx,
      "order_items",
      lines.map((l) => {
        const unit = round2(money(l.variant.price));
        return {
          orderId: id,
          productId: l.variant.productId,
          variantId: l.variant.id,
          productSlug: l.variant.product.slug,
          productName: l.variant.product.name,
          brandName: l.variant.product.brand.name,
          sizeMl: l.variant.sizeMl,
          sku: l.variant.sku,
          unitPrice: unit,
          quantity: l.quantity,
          lineTotal: unit.times(l.quantity),
        };
      }),
    );
    await addStatusHistory(tx, id, "PENDING_PAYMENT", input.userId ?? "customer", isTest ? "Test order (integrations in development mode)." : null);
    if (couponId) await insert(tx, "coupon_redemptions", { couponId, orderId: id, email: input.email, amount: quote.discount });
    return id;
  });

  const payment = await initiatePayment(orderId, input.idempotencyKey ? `${input.idempotencyKey}:1` : undefined);
  const full = (await findOrder(sql`id = ${orderId}`))!;

  await sendEmail({
    to: full.email,
    subject: `Your AZMARO order ${full.orderNumber}`,
    template: "order-confirmation",
    text: `Thank you for your order ${full.orderNumber}. Total payable: ₹${toAmount(full.total)}.`,
    data: { orderNumber: full.orderNumber, total: toAmount(full.total), isTest: full.isTest },
  });

  return { order: full, payment, replayed: false };
}

/** Customer / guest access: owner by account, or by order number + matching email/phone. */
export async function findOrderForCustomer(orderNumber: string, who: { userId?: string; contact?: string }) {
  const order = await findOrder(sql`orderNumber = ${orderNumber}`);
  if (!order) throw notFound("Order");
  if (who.userId && order.userId === who.userId) return order;
  const contact = who.contact?.trim().toLowerCase();
  if (contact) {
    const digits = contact.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
    if (contact === order.email || (digits.length === 10 && digits === order.phone)) return order;
  }
  throw notFound("Order");
}

export async function listOrdersForUser(userId: string, page: number, pageSize: number) {
  const [count, records] = await Promise.all([
    db.one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM orders WHERE userId = ${userId}`),
    db.many<OrderRecord>(sql`SELECT * FROM orders WHERE userId = ${userId} ORDER BY createdAt DESC, id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
  ]);
  return { total: count!.n, rows: await loadOrders(records) };
}

/** Allowed manual (admin) status transitions. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PLACED", "CANCELLED"],
  PLACED: ["CONFIRMED", "PROCESSING", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "SHIPPED", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

/** Set an order's status and append it to the status history. */
export async function recordStatus(tx: Db, orderId: string, status: OrderStatus, actor: string, note?: string | null) {
  await update(tx, "orders", { status }, sql`id = ${orderId}`);
  await addStatusHistory(tx, orderId, status, actor, note);
}

export async function transitionOrder(orderId: string, to: OrderStatus, actor: string, note?: string) {
  const order = await db.one<OrderRecord>(sql`SELECT * FROM orders WHERE id = ${orderId}`);
  if (!order) throw notFound("Order");
  if (to === "CANCELLED") return cancelOrder(order.orderNumber, actor, note ?? "Cancelled by AZMARO", { force: true });
  if (!ORDER_TRANSITIONS[order.status].includes(to))
    throw unprocessable(`Cannot move an order from ${order.status} to ${to}.`, { allowed: ORDER_TRANSITIONS[order.status] }, "INVALID_TRANSITION");
  await transaction((tx) => recordStatus(tx, orderId, to, actor, note));
  return (await findOrder(sql`id = ${orderId}`))!;
}

/**
 * Cancel according to the configured policy: customers may cancel only in the
 * configured statuses and before a shipment is booked. Restocks tracked
 * inventory, releases the coupon use and settles the payment state.
 */
export async function cancelOrder(orderNumber: string, actor: string, reason: string, opts: { force?: boolean } = {}): Promise<OrderRow> {
  const order = await findOrder(sql`orderNumber = ${orderNumber}`);
  if (!order) throw notFound("Order");
  if (order.status === "CANCELLED") return order;
  const policy = await getSetting("orders");
  const booked = order.shipments.some((s) => s.status !== "CANCELLED" && s.status !== "PENDING");
  if (!opts.force && (!(policy.cancellableStatuses as string[]).includes(order.status) || booked)) {
    throw new AppError(409, "NOT_CANCELLABLE", "This order can no longer be cancelled online. Please contact support.");
  }
  if (opts.force && !ORDER_TRANSITIONS[order.status].includes("CANCELLED")) {
    throw unprocessable(`Orders in status ${order.status} cannot be cancelled.`, undefined, "INVALID_TRANSITION");
  }

  await transaction(async (tx) => {
    for (const item of order.items) {
      if (!item.variantId) continue;
      await tx.run(sql`UPDATE inventory SET quantity = quantity + ${item.quantity} WHERE variantId = ${item.variantId} AND quantity IS NOT NULL`);
    }
    const redemption = await tx.one<CouponRedemptionRow>(sql`SELECT * FROM coupon_redemptions WHERE orderId = ${order.id}`);
    if (redemption) {
      await tx.run(sql`DELETE FROM coupon_redemptions WHERE id = ${redemption.id}`);
      await tx.run(sql`UPDATE coupons SET usedCount = usedCount - 1 WHERE id = ${redemption.couponId}`);
    }
    const paid = order.payments.some((p) => p.status === "PAID" || p.status === "AUTHORIZED");
    for (const p of order.payments) {
      if (["PENDING", "NOT_COLLECTED", "COD_PENDING"].includes(p.status)) await update(tx, "payments", { status: "CANCELLED" }, sql`id = ${p.id}`);
    }
    await update(
      tx,
      "orders",
      { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason.slice(0, 255), paymentStatus: paid ? "REFUND_PENDING" : "CANCELLED" },
      sql`id = ${order.id}`,
    );
    await addStatusHistory(tx, order.id, "CANCELLED", actor, reason.slice(0, 500));
  });

  const updated = (await findOrder(sql`id = ${order.id}`))!;
  await sendEmail({
    to: updated.email,
    subject: `Order ${updated.orderNumber} cancelled`,
    template: "order-cancelled",
    text: `Your order ${updated.orderNumber} has been cancelled.${updated.paymentStatus === "REFUND_PENDING" ? " Your refund will be processed to the original payment method." : ""}`,
    data: { orderNumber: updated.orderNumber, refundPending: updated.paymentStatus === "REFUND_PENDING" },
  });
  return updated;
}

/** Release stock held by online orders that never completed payment. */
export async function cancelStalePendingOrders(olderThanMinutes: number, actor = "system") {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const stale = await db.many<{ orderNumber: string }>(
    sql`SELECT orderNumber FROM orders WHERE status = 'PENDING_PAYMENT' AND createdAt < ${cutoff} AND paymentMethod <> 'COD'`,
  );
  const cancelled: string[] = [];
  for (const o of stale) {
    await cancelOrder(o.orderNumber, actor, "Payment not completed in time.", { force: true });
    cancelled.push(o.orderNumber);
  }
  return cancelled;
}
