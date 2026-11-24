import { env } from "../../config/env";
import type { PaymentStatus } from "../../db";
import { hmacSha256Hex, safeEqual, sha256 } from "../../utils/crypto";
import { providerFetch } from "../http";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  NormalisedWebhookEvent,
  PaymentProvider,
  WebhookCapableProvider,
} from "./types";

/**
 * Razorpay adapter (UPI, cards, net banking via Razorpay Checkout).
 *
 * Implemented against Razorpay's documented REST API:
 *  - POST /v1/orders                     create an order for Checkout
 *  - payment signature  HMAC_SHA256(order_id|payment_id, key_secret)
 *  - webhook signature  HMAC_SHA256(raw body, webhook secret) in X-Razorpay-Signature
 *  - POST /v1/payments/:id/refund        refunds
 *
 * Card / UPI / bank details are entered only in Razorpay Checkout – never sent
 * to or stored by AZMARO. NOT yet exercised against a live Razorpay account:
 * verify end-to-end in Razorpay test mode before launch.
 */
const API = "https://api.razorpay.com/v1";

const authHeader = () =>
  `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;

const header = (h: Record<string, string | string[] | undefined>, name: string) => {
  const v = h[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
};

interface RazorpayOrder {
  id: string;
  status: string;
  amount: number;
}

export class RazorpayProvider implements PaymentProvider, WebhookCapableProvider {
  readonly name = "razorpay";
  readonly isTest = Boolean(env.RAZORPAY_KEY_ID?.startsWith("rzp_test_"));

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const order = await providerFetch<RazorpayOrder>("razorpay", `${API}/orders`, {
      method: "POST",
      headers: { Authorization: authHeader() },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.orderNumber,
        notes: { orderNumber: input.orderNumber, attempt: input.idempotencyKey },
      }),
    });
    return {
      providerOrderId: order.id,
      status: "PENDING",
      isTest: this.isTest,
      message: "Complete payment in the secure Razorpay window.",
      clientAction: {
        type: "razorpay_checkout",
        keyId: env.RAZORPAY_KEY_ID!,
        providerOrderId: order.id,
        amountPaise: input.amountPaise,
        currency: input.currency,
        name: "AZMARO",
        description: `Order ${input.orderNumber}`,
        prefill: { name: input.customer.name, email: input.customer.email, contact: input.customer.phone },
        method: input.method,
      },
    };
  }

  /** Verifies the signature Razorpay Checkout returns to the browser after payment. */
  verifyPaymentSignature(providerOrderId: string, providerPaymentId: string, signature: string): boolean {
    if (!env.RAZORPAY_KEY_SECRET) return false;
    const expected = hmacSha256Hex(env.RAZORPAY_KEY_SECRET, `${providerOrderId}|${providerPaymentId}`);
    return safeEqual(expected, signature);
  }

  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    const signature = header(headers, "x-razorpay-signature");
    if (!secret || !signature) return false;
    return safeEqual(hmacSha256Hex(secret, rawBody), signature);
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalisedWebhookEvent {
    const body = JSON.parse(rawBody.toString("utf8")) as {
      event: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string; status?: string; amount?: number; error_description?: string } };
        order?: { entity?: { id?: string; amount_paid?: number; status?: string } };
        refund?: { entity?: { payment_id?: string; amount?: number; status?: string } };
      };
    };
    const payment = body.payload?.payment?.entity;
    const order = body.payload?.order?.entity;
    const refund = body.payload?.refund?.entity;

    const statusByEvent: Record<string, PaymentStatus> = {
      "payment.authorized": "AUTHORIZED",
      "payment.captured": "PAID",
      "order.paid": "PAID",
      "payment.failed": "FAILED",
      "refund.processed": "REFUNDED",
    };

    return {
      eventId: header(headers, "x-razorpay-event-id") ?? sha256(rawBody.toString("utf8")),
      eventType: body.event,
      providerOrderId: payment?.order_id ?? order?.id ?? null,
      providerPaymentId: payment?.id ?? refund?.payment_id ?? null,
      status: statusByEvent[body.event] ?? null,
      amountPaise: payment?.amount ?? order?.amount_paid ?? refund?.amount ?? null,
      failureReason: payment?.error_description ?? null,
      providerStatus: payment?.status ?? order?.status ?? refund?.status ?? null,
    };
  }

  async refund(providerPaymentId: string, amountPaise: number): Promise<{ id: string; status: string }> {
    return providerFetch("razorpay", `${API}/payments/${encodeURIComponent(providerPaymentId)}/refund`, {
      method: "POST",
      headers: { Authorization: authHeader() },
      body: JSON.stringify({ amount: amountPaise }),
    });
  }
}
