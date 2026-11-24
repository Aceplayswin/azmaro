import type { ShipmentStatus } from "../../db";

export interface ServiceabilityResult {
  status: "SERVICEABLE" | "UNSERVICEABLE" | "UNAVAILABLE";
  /** true when no real courier was consulted */
  isTest: boolean;
  message: string;
  /** Courier-quoted rate in INR, or null */
  courierRate: number | null;
  /** Courier-provided estimate text – never invented */
  estimate: string | null;
  courier: string | null;
  codAvailable: boolean | null;
}

export interface ShipmentRequest {
  orderNumber: string;
  createdAt: Date;
  customer: { name: string; email: string; phone: string };
  address: { line1: string; line2?: string | null; landmark?: string | null; city: string; state: string; pin: string };
  items: Array<{ name: string; sku: string | null; quantity: number; unitPrice: number }>;
  subtotal: number;
  paymentMethod: "COD" | "PREPAID";
  weightGrams: number;
}

export interface ShipmentResult {
  providerShipmentId: string | null;
  awb: string | null;
  courier: string | null;
  labelUrl: string | null;
  status: ShipmentStatus;
}

export interface TrackingEvent {
  status: ShipmentStatus;
  description: string;
  location: string | null;
  occurredAt: Date;
  externalId: string | null;
}

export interface TrackingResult {
  status: ShipmentStatus | null;
  courier: string | null;
  events: TrackingEvent[];
}

export interface ShippingProvider {
  readonly name: string;
  readonly isTest: boolean;
  checkServiceability(pin: string, opts: { cod: boolean; weightGrams: number }): Promise<ServiceabilityResult>;
  createShipment(req: ShipmentRequest): Promise<ShipmentResult>;
  track(awb: string): Promise<TrackingResult>;
}
