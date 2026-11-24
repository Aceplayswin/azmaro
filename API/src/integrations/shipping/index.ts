import { env, integrations } from "../../config/env";
import { AppError } from "../../utils/errors";
import { ShiprocketProvider } from "./shiprocket";
import type { ServiceabilityResult, ShippingProvider } from "./types";

/**
 * Development shipping adapter – used when no courier is configured. It never
 * invents serviceability, delivery estimates or scan events. Shipments must be
 * booked manually by staff (courier + AWB) until a courier is connected.
 */
class DevelopmentShippingProvider implements ShippingProvider {
  readonly name = "development";
  // Only flagged as a test adapter in demo mode; in live mode it is the "no courier API" fallback.
  readonly isTest = env.INTEGRATION_MODE === "demo";

  async checkServiceability(pin: string): Promise<ServiceabilityResult> {
    return {
      status: "UNAVAILABLE",
      isTest: this.isTest,
      message: `We deliver across India. The delivery date for PIN ${pin} is confirmed when your order is dispatched.`,
      courierRate: null,
      estimate: null,
      courier: null,
      codAvailable: null,
    };
  }

  async createShipment(): Promise<never> {
    throw new AppError(
      503,
      "COURIER_NOT_CONFIGURED",
      "No courier integration is connected. Book the shipment manually by providing the courier name and AWB.",
    );
  }

  async track(): Promise<{ status: null; courier: null; events: [] }> {
    return { status: null, courier: null, events: [] };
  }
}

let provider: ShippingProvider | null = null;

export function getShippingProvider(): ShippingProvider {
  if (provider) return provider;
  provider = integrations.shipping.shiprocket ? new ShiprocketProvider() : new DevelopmentShippingProvider();
  return provider;
}

export function shippingIntegrationStatus() {
  return {
    provider: integrations.shipping.shiprocket ? "shiprocket" : env.INTEGRATION_MODE === "demo" ? "development" : "none",
    configured: integrations.shipping.shiprocket,
    webhookSecretConfigured: integrations.shipping.webhookSecretConfigured,
  };
}
