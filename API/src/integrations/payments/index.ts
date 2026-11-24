import { env, integrations } from "../../config/env";
import type { CreatePaymentInput, CreatePaymentResult, PaymentProvider } from "./types";
import { RazorpayProvider } from "./razorpay";

/**
 * Development adapter – used ONLY when no payment provider is configured and
 * INTEGRATION_MODE=demo. It never reports a successful payment: the payment is
 * recorded as NOT_COLLECTED and the order stays PENDING_PAYMENT, clearly
 * marked as a test order.
 */
class DevelopmentPaymentProvider implements PaymentProvider {
  readonly name = "development";
  readonly isTest = true;
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    void input;
    return {
      providerOrderId: null,
      status: "NOT_COLLECTED",
      clientAction: null,
      isTest: true,
      message: "Development mode: no payment provider is connected, so no payment was collected. This is a test order.",
    };
  }
}

/** Cash on delivery – no gateway involved; payment is collected by the courier. */
class CodProvider implements PaymentProvider {
  readonly name = "cod";
  readonly isTest = false;
  async createPayment(): Promise<CreatePaymentResult> {
    return {
      providerOrderId: null,
      status: "COD_PENDING",
      clientAction: null,
      isTest: false,
      message: "Pay in cash when your order is delivered.",
    };
  }
}

let razorpay: RazorpayProvider | null = null;

export const getRazorpay = () => (razorpay ??= new RazorpayProvider());

/** Provider for UPI / cards / net banking, or null when online payment is unavailable. */
export function getOnlinePaymentProvider(): PaymentProvider | null {
  if (integrations.payments.razorpay) return getRazorpay();
  if (env.INTEGRATION_MODE === "demo") return new DevelopmentPaymentProvider();
  return null;
}

export const codProvider = new CodProvider();

export function paymentIntegrationStatus() {
  return {
    provider: integrations.payments.razorpay ? "razorpay" : env.INTEGRATION_MODE === "demo" ? "development" : "none",
    configured: integrations.payments.razorpay,
    testKeys: integrations.payments.razorpay ? getRazorpay().isTest : null,
    webhookSecretConfigured: integrations.payments.webhookSecretConfigured,
  };
}
