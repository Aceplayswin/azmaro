/**
 * Integration contracts. UI components depend only on these shapes, never on a
 * specific courier, payment gateway, auth or email provider.
 */

export type PaymentMethod = "upi" | "card" | "netbanking" | "cod";

export interface ServiceabilityResult {
  status: "serviceable" | "unserviceable" | "unavailable";
  /** true when the response comes from the test adapter, not a real courier */
  demo: boolean;
  message: string;
  /** delivery fee in INR, or null when not known */
  fee: number | null;
  /** courier-provided estimate text; null unless a courier returned one */
  estimate: string | null;
  courier: string | null;
  codAvailable: boolean | null;
}

export interface ShipmentEvent {
  at: string; // ISO timestamp
  status: "placed" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "exception";
  description: string;
  location?: string | null;
}

export interface TrackingResult {
  found: boolean;
  demo: boolean;
  message?: string;
  orderNumber?: string;
  status?: string;
  courier?: string | null;
  awb?: string | null;
  events?: ShipmentEvent[];
}

export interface OrderLineInput {
  slug: string;
  sizeMl: number;
  qty: number;
}

export interface OrderAddress {
  fullName: string;
  pin: string;
  addressLine: string;
  landmark?: string;
  city: string;
  state: string;
}

export interface CreateOrderInput {
  email: string;
  phone: string;
  address: OrderAddress;
  paymentMethod: PaymentMethod;
  discountCode?: string | null;
  lines: OrderLineInput[];
}

export interface OrderLine {
  slug: string;
  name: string;
  brandName: string;
  sizeMl: number;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  orderNumber: string;
  createdAt: string;
  demo: boolean;
  email: string;
  phone: string;
  address: OrderAddress;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  delivery: number | null;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: "not_collected" | "pending" | "cod_pending" | "paid" | "failed";
  status: "placed" | "awaiting_payment";
  /** URL to redirect to for gateway payment, when a live gateway is configured */
  paymentRedirectUrl?: string | null;
  events: ShipmentEvent[];
}

export interface SessionUser {
  name: string;
  email: string;
  demo: boolean;
}

/** GET /api/status */
export interface IntegrationStatus {
  mode: "demo" | "live";
  payments: {
    configured: boolean;
    /** UPI / cards / net banking can be taken (real gateway, or demo mode). */
    onlineAvailable?: boolean;
    onlineMethods?: Array<"UPI" | "CARD" | "NETBANKING">;
    codEnabled?: boolean;
    codMaxOrderInr?: number | null;
  };
  shipping: { configured: boolean };
  auth: { configured: boolean };
}
