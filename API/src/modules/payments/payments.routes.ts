import { z } from "zod";
import { moduleRouter } from "../../routes/router";
import { ok } from "../../utils/response";
import { orderNumber } from "../../validators/common";
import { findOrderForCustomer } from "../orders/order.service";
import { handleWebhook, retryPayment, verifyRazorpayCheckout } from "./payment.service";

const verifySchema = z.object({
  orderNumber,
  razorpay_order_id: z.string().min(5).max(100),
  razorpay_payment_id: z.string().min(5).max(100),
  razorpay_signature: z.string().min(10).max(200),
});

const retrySchema = z.object({ orderNumber, contact: z.string().trim().max(191).optional() });

export const paymentsRoutes = moduleRouter("/payments", "Payments");

paymentsRoutes.post(
  "/razorpay/verify",
  {
    summary: "Verify Razorpay Checkout result (signature check) and mark the payment paid",
    description: "Call with the three values Razorpay Checkout returns in its success handler. Webhooks remain the authoritative source and reconcile any mismatch.",
    auth: "optional",
    body: verifySchema,
  },
  async (req, res) => {
    const input = verifySchema.parse(req.body);
    const payment = await verifyRazorpayCheckout({
      orderNumber: input.orderNumber,
      razorpayOrderId: input.razorpay_order_id,
      razorpayPaymentId: input.razorpay_payment_id,
      razorpaySignature: input.razorpay_signature,
    });
    return ok(res, { status: payment.status }, "Payment verified.");
  },
);

paymentsRoutes.post(
  "/retry",
  {
    summary: "Start a new payment attempt for an order awaiting payment",
    description: "Send an `Idempotency-Key` header to make retries safe.",
    auth: "optional",
    body: retrySchema,
  },
  async (req, res) => {
    const input = retrySchema.parse(req.body);
    const order = await findOrderForCustomer(input.orderNumber, { userId: req.auth?.userId, contact: input.contact });
    return ok(res, await retryPayment(order.id, req.get("idempotency-key") ?? undefined));
  },
);

paymentsRoutes.post(
  "/webhooks/:provider",
  {
    summary: "Payment provider webhook (signature-verified, idempotent)",
    description:
      "Razorpay: configure the webhook URL `/api/v1/payments/webhooks/razorpay` with events payment.authorized, payment.captured, payment.failed, order.paid, refund.processed. The `X-Razorpay-Signature` header is verified (HMAC-SHA256 of the raw body). Replayed events (same `X-Razorpay-Event-Id`) are acknowledged and ignored.",
  },
  async (req, res) => {
    const result = await handleWebhook(String(req.params.provider), req.rawBody, req.headers);
    return ok(res, result, result.duplicate ? "Duplicate event ignored." : "Webhook processed.");
  },
);
