import type { PaymentMethod, PaymentStatus } from "../../db";

export interface CreatePaymentInput {
  orderNumber: string;
  amountPaise: number;
  currency: "INR";
  method: PaymentMethod;
  customer: { name: string; email: string; phone: string };
  idempotencyKey: string;
}

/** What the frontend must do next to complete payment (null = nothing). */
export type ClientAction = {
  type: "razorpay_checkout";
  keyId: string;
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  method: PaymentMethod;
} | null;

export interface CreatePaymentResult {
  providerOrderId: string | null;
  status: PaymentStatus;
  clientAction: ClientAction;
  isTest: boolean;
  message: string;
}

export interface NormalisedWebhookEvent {
  eventId: string;
  eventType: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  /** null = event not relevant to payment status */
  status: PaymentStatus | null;
  amountPaise: number | null;
  failureReason: string | null;
  providerStatus: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  readonly isTest: boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
}

export interface WebhookCapableProvider {
  readonly name: string;
  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalisedWebhookEvent;
}
