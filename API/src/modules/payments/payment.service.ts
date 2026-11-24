import { randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { db, insert, isDuplicateKey, join, sql, transaction, update, type Db, type OrderRecord, type PaymentRow, type PaymentStatus } from "../../db";
import { codProvider, getOnlinePaymentProvider, getRazorpay } from "../../integrations/payments";
import type { ClientAction, NormalisedWebhookEvent, WebhookCapableProvider } from "../../integrations/payments/types";
import { ProviderError } from "../../integrations/http";
import { addStatusHistory } from "../orders/order.dto";
import { AppError, notFound, serviceUnavailable, unprocessable } from "../../utils/errors";
import { toPaise } from "../../utils/money";

/**
 * Payment orchestration. Rules:
 *  - a successful payment is ONLY recorded from a verified provider signal
 *    (webhook signature or Razorpay checkout signature) – never simulated
 *  - each attempt has a unique idempotency key; webhooks are de-duplicated by event id
 *  - status changes are monotonic (a PAID payment is never downgraded by a late "failed" event)
 */

export interface PaymentInitiation {
  provider: string;
  status: PaymentStatus;
  isTest: boolean;
  message: string;
  clientAction: ClientAction;
}

/** Create a payment attempt for an order and update the order's payment state. */
export async function initiatePayment(orderId: string, idempotencyKey = `pay_${randomUUID()}`): Promise<PaymentInitiation> {
  const existing = await db.one<PaymentRow>(sql`SELECT * FROM payments WHERE idempotencyKey = ${idempotencyKey}`);
  const order = await db.one<OrderRecord>(sql`SELECT * FROM orders WHERE id = ${orderId}`);
  if (!order) throw notFound("Order");
  if (existing) {
    return { provider: existing.provider, status: existing.status, isTest: existing.isTest, message: "Existing payment attempt.", clientAction: null };
  }

  const provider = order.paymentMethod === "COD" ? codProvider : getOnlinePaymentProvider();
  if (!provider) {
    throw serviceUnavailable("Online payments are not available yet. Please choose cash on delivery or try again later.", "PAYMENT_PROVIDER_UNAVAILABLE");
  }

  let result;
  try {
    result = await provider.createPayment({
      orderNumber: order.orderNumber,
      amountPaise: toPaise(order.total),
      currency: "INR",
      method: order.paymentMethod,
      customer: { name: order.shipName, email: order.email, phone: order.phone },
      idempotencyKey,
    });
  } catch (e) {
    await insert(db, "payments", {
      orderId,
      provider: provider.name,
      method: order.paymentMethod,
      status: "FAILED",
      amount: order.total,
      idempotencyKey,
      failureReason: e instanceof ProviderError ? e.message.slice(0, 500) : "Payment provider error",
      isTest: provider.isTest,
    });
    await update(db, "orders", { paymentStatus: "FAILED" }, sql`id = ${orderId}`);
    throw new AppError(502, "PAYMENT_PROVIDER_ERROR", "We couldn't start the payment. Your order is saved – please try paying again.");
  }

  await transaction(async (tx) => {
    await insert(tx, "payments", {
      orderId,
      provider: provider.name,
      method: order.paymentMethod,
      status: result.status,
      amount: order.total,
      idempotencyKey,
      providerOrderId: result.providerOrderId,
      isTest: result.isTest,
    });
    // COD orders are placed immediately; online orders wait for a verified payment.
    if (order.paymentMethod === "COD" && order.status === "PENDING_PAYMENT") {
      await update(tx, "orders", { status: "PLACED", paymentStatus: "COD_PENDING" }, sql`id = ${orderId}`);
      await addStatusHistory(tx, orderId, "PLACED", "system", "Cash on delivery order placed.");
    } else {
      await update(tx, "orders", { paymentStatus: result.status }, sql`id = ${orderId}`);
    }
  });

  return { provider: provider.name, status: result.status, isTest: result.isTest, message: result.message, clientAction: result.clientAction };
}

/** Retry payment for an order still awaiting payment (new attempt, new idempotency key). */
export async function retryPayment(orderId: string, idempotencyKey?: string) {
  const order = await db.one<OrderRecord>(sql`SELECT * FROM orders WHERE id = ${orderId}`);
  if (!order) throw notFound("Order");
  if (order.status !== "PENDING_PAYMENT" || order.paymentMethod === "COD")
    throw unprocessable("This order is not awaiting payment.", undefined, "PAYMENT_NOT_REQUIRED");
  return initiatePayment(orderId, idempotencyKey ? `retry:${idempotencyKey}` : undefined);
}

const RANK: Record<PaymentStatus, number> = {
  NOT_COLLECTED: 0,
  PENDING: 1,
  COD_PENDING: 1,
  FAILED: 2,
  CANCELLED: 2,
  AUTHORIZED: 3,
  PAID: 4,
  REFUND_PENDING: 5,
  REFUNDED: 6,
};

/** Apply a verified provider status to a payment + its order (monotonic). */
async function applyStatus(
  tx: Db,
  paymentId: string,
  status: PaymentStatus,
  details: { providerPaymentId?: string | null; providerStatus?: string | null; failureReason?: string | null },
) {
  const payment = (await tx.one<PaymentRow>(sql`SELECT * FROM payments WHERE id = ${paymentId} FOR UPDATE`))!;
  const order = (await tx.one<OrderRecord>(sql`SELECT * FROM orders WHERE id = ${payment.orderId}`))!;
  const allowed =
    RANK[status] > RANK[payment.status] || (payment.status === "FAILED" && (status === "PAID" || status === "AUTHORIZED"));
  if (!allowed) return { changed: false, payment };

  await update(
    tx,
    "payments",
    {
      status,
      providerPaymentId: details.providerPaymentId ?? payment.providerPaymentId,
      providerStatus: details.providerStatus ?? payment.providerStatus,
      failureReason: status === "FAILED" ? (details.failureReason ?? "Payment failed") : payment.failureReason,
    },
    sql`id = ${paymentId}`,
  );

  if ((status === "PAID" || status === "AUTHORIZED") && order.status === "CANCELLED") {
    // Money arrived for a cancelled order – flag for refund.
    await update(tx, "orders", { paymentStatus: "REFUND_PENDING" }, sql`id = ${order.id}`);
  } else {
    await update(tx, "orders", { paymentStatus: status }, sql`id = ${order.id}`);
    if ((status === "PAID" || status === "AUTHORIZED") && order.status === "PENDING_PAYMENT") {
      await update(tx, "orders", { status: "PLACED" }, sql`id = ${order.id}`);
      await addStatusHistory(tx, order.id, "PLACED", "system", `Payment ${status.toLowerCase()} (${payment.provider}).`);
    }
  }
  return { changed: true, payment };
}

/**
 * Handle a provider webhook: verify the signature over the RAW body, store the
 * event once (replays are acknowledged but ignored), check the amount, then
 * apply the status.
 */
export async function handleWebhook(providerName: string, rawBody: Buffer | undefined, headers: Record<string, string | string[] | undefined>) {
  let provider: WebhookCapableProvider;
  if (providerName === "razorpay") provider = getRazorpay();
  else throw notFound("Payment provider");

  if (!rawBody || !provider.verifyWebhookSignature(rawBody, headers)) {
    throw new AppError(401, "INVALID_SIGNATURE", "Webhook signature verification failed.");
  }

  let event: NormalisedWebhookEvent;
  try {
    event = provider.parseWebhook(rawBody, headers);
  } catch {
    throw new AppError(400, "INVALID_PAYLOAD", "Webhook payload could not be parsed.");
  }

  try {
    await insert(db, "payment_webhook_events", {
      provider: providerName,
      eventId: event.eventId,
      eventType: event.eventType,
      payload: JSON.stringify(JSON.parse(rawBody.toString("utf8"))),
    });
  } catch (e) {
    if (isDuplicateKey(e)) return { duplicate: true, applied: false, eventId: event.eventId };
    throw e;
  }

  const finish = (error: string | null, applied: boolean) =>
    update(db, "payment_webhook_events", { processedAt: new Date(), error }, sql`provider = ${providerName} AND eventId = ${event.eventId}`).then(() => ({
      duplicate: false,
      applied,
      eventId: event.eventId,
      error,
    }));

  if (!event.status) return finish("Event type not relevant to payment status.", false);

  const match = [
    ...(event.providerOrderId ? [sql`providerOrderId = ${event.providerOrderId}`] : []),
    ...(event.providerPaymentId ? [sql`providerPaymentId = ${event.providerPaymentId}`] : []),
  ];
  const payment = match.length
    ? await db.one<PaymentRow>(sql`SELECT * FROM payments WHERE provider = ${providerName} AND (${join(match, " OR ")}) LIMIT 1`)
    : null;
  if (!payment) return finish("No matching payment.", false);
  if (event.amountPaise !== null && event.status !== "REFUNDED" && event.amountPaise !== toPaise(payment.amount)) {
    return finish(`Amount mismatch: expected ${toPaise(payment.amount)}, got ${event.amountPaise}.`, false);
  }

  const { changed } = await transaction((tx) =>
    applyStatus(tx, payment.id, event.status!, {
      providerPaymentId: event.providerPaymentId,
      providerStatus: event.providerStatus,
      failureReason: event.failureReason,
    }),
  );
  return finish(changed ? null : "Status unchanged (stale or duplicate state).", changed);
}

/** Verify the signature Razorpay Checkout returns to the browser, then mark the payment as paid. */
export async function verifyRazorpayCheckout(input: {
  orderNumber: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  if (env.PAYMENT_PROVIDER !== "razorpay") throw serviceUnavailable("Razorpay is not configured.", "PAYMENT_PROVIDER_UNAVAILABLE");
  const payment = await db.one<PaymentRow>(sql`
    SELECT pay.* FROM payments pay JOIN orders o ON o.id = pay.orderId
    WHERE pay.provider = 'razorpay' AND pay.providerOrderId = ${input.razorpayOrderId} AND o.orderNumber = ${input.orderNumber}`);
  if (!payment) throw notFound("Payment");
  if (!getRazorpay().verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
    throw new AppError(400, "INVALID_SIGNATURE", "Payment verification failed. If money was debited, it will be reconciled automatically.");
  }
  await transaction((tx) =>
    applyStatus(tx, payment.id, "PAID", { providerPaymentId: input.razorpayPaymentId, providerStatus: "checkout_verified" }),
  );
  return (await db.one<PaymentRow>(sql`SELECT * FROM payments WHERE id = ${payment.id}`))!;
}

/** Admin: start a refund via the provider for a paid, cancelled order. */
export async function refundOrderPayment(orderId: string) {
  const payment = await db.one<PaymentRow>(sql`SELECT * FROM payments WHERE orderId = ${orderId} AND status = 'PAID' ORDER BY createdAt DESC, id DESC LIMIT 1`);
  if (!payment) throw unprocessable("No paid payment to refund for this order.", undefined, "NOTHING_TO_REFUND");
  if (payment.provider !== "razorpay" || !payment.providerPaymentId)
    throw unprocessable("Refunds for this payment must be processed manually.", undefined, "MANUAL_REFUND_REQUIRED");
  const refund = await getRazorpay().refund(payment.providerPaymentId, toPaise(payment.amount));
  await transaction(async (tx) => {
    await update(tx, "payments", { status: "REFUND_PENDING", providerStatus: `refund:${refund.status}` }, sql`id = ${payment.id}`);
    await update(tx, "orders", { paymentStatus: "REFUND_PENDING" }, sql`id = ${orderId}`);
  });
  return refund;
}
