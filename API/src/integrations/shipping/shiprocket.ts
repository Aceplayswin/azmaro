import { env } from "../../config/env";
import type { ShipmentStatus } from "../../db";
import { providerFetch, ProviderError } from "../http";
import type { ServiceabilityResult, ShipmentRequest, ShipmentResult, ShippingProvider, TrackingResult } from "./types";

/**
 * Shiprocket adapter, implemented against Shiprocket's external REST API:
 *  - POST /auth/login                         → bearer token (valid ~10 days)
 *  - GET  /courier/serviceability/            → couriers, rates, ETD for a PIN
 *  - POST /orders/create/adhoc                → creates the shipment
 *  - POST /courier/assign/awb                 → assigns courier + AWB
 *  - GET  /courier/track/awb/:awb             → scan history
 * Only values returned by Shiprocket are passed on – nothing is estimated
 * locally. NOT yet exercised against a live account: test with Shiprocket
 * credentials before launch.
 */
const API = "https://apiv2.shiprocket.in/v1/external";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function token(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  const res = await providerFetch<{ token: string }>("shiprocket", `${API}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
  });
  cachedToken = { token: res.token, expiresAt: Date.now() + 9 * 86_400_000 };
  return res.token;
}

const auth = async () => ({ Authorization: `Bearer ${await token()}` });

/** Map Shiprocket's free-text statuses onto our enum. */
export function mapShiprocketStatus(raw: string | null | undefined): ShipmentStatus | null {
  const s = (raw ?? "").toUpperCase();
  if (!s) return null;
  if (s.includes("RTO")) return "RETURN_TO_ORIGIN";
  if (s.includes("OUT FOR DELIVERY")) return "OUT_FOR_DELIVERY";
  if (s.includes("DELIVERED")) return "DELIVERED";
  if (s.includes("CANCEL")) return "CANCELLED";
  if (s.includes("PICKED UP") || s.includes("PICKUP COMPLETE")) return "PICKED_UP";
  if (s.includes("TRANSIT") || s.includes("SHIPPED") || s.includes("REACHED")) return "IN_TRANSIT";
  if (s.includes("AWB ASSIGNED") || s.includes("PICKUP SCHEDULED") || s.includes("MANIFEST")) return "BOOKED";
  if (s.includes("EXCEPTION") || s.includes("UNDELIVERED") || s.includes("LOST") || s.includes("DAMAGE")) return "EXCEPTION";
  return null;
}

interface ServiceabilityResponse {
  data?: {
    available_courier_companies?: Array<{ courier_name: string; rate: number; etd?: string; cod?: number }>;
    recommended_courier_company_id?: number;
  };
}

export class ShiprocketProvider implements ShippingProvider {
  readonly name = "shiprocket";
  readonly isTest = false;

  async checkServiceability(pin: string, opts: { cod: boolean; weightGrams: number }): Promise<ServiceabilityResult> {
    if (!env.SHIPROCKET_PICKUP_PIN) throw new ProviderError("shiprocket", "SHIPROCKET_PICKUP_PIN is not configured");
    const qs = new URLSearchParams({
      pickup_postcode: env.SHIPROCKET_PICKUP_PIN,
      delivery_postcode: pin,
      weight: String(opts.weightGrams / 1000),
      cod: opts.cod ? "1" : "0",
    });
    const res = await providerFetch<ServiceabilityResponse>("shiprocket", `${API}/courier/serviceability/?${qs}`, {
      headers: await auth(),
    });
    const couriers = res.data?.available_courier_companies ?? [];
    if (!couriers.length) {
      return {
        status: "UNSERVICEABLE",
        isTest: false,
        message: `Delivery to PIN ${pin} is not available right now.`,
        courierRate: null,
        estimate: null,
        courier: null,
        codAvailable: false,
      };
    }
    const best = [...couriers].sort((a, b) => a.rate - b.rate)[0]!;
    return {
      status: "SERVICEABLE",
      isTest: false,
      message: `Delivery available to PIN ${pin}.`,
      courierRate: best.rate,
      estimate: best.etd ?? null,
      courier: best.courier_name,
      codAvailable: couriers.some((c) => c.cod === 1),
    };
  }

  async createShipment(req: ShipmentRequest): Promise<ShipmentResult> {
    const created = await providerFetch<{ order_id: number; shipment_id: number }>(
      "shiprocket",
      `${API}/orders/create/adhoc`,
      {
        method: "POST",
        headers: await auth(),
        body: JSON.stringify({
          order_id: req.orderNumber,
          order_date: req.createdAt.toISOString().slice(0, 16).replace("T", " "),
          pickup_location: env.SHIPROCKET_PICKUP_LOCATION ?? "Primary",
          billing_customer_name: req.customer.name,
          billing_last_name: "",
          billing_address: req.address.line1,
          billing_address_2: [req.address.line2, req.address.landmark].filter(Boolean).join(", "),
          billing_city: req.address.city,
          billing_pincode: req.address.pin,
          billing_state: req.address.state,
          billing_country: "India",
          billing_email: req.customer.email,
          billing_phone: req.customer.phone,
          shipping_is_billing: true,
          order_items: req.items.map((i) => ({
            name: i.name,
            sku: i.sku ?? i.name,
            units: i.quantity,
            selling_price: i.unitPrice,
          })),
          payment_method: req.paymentMethod === "COD" ? "COD" : "Prepaid",
          sub_total: req.subtotal,
          length: 15,
          breadth: 10,
          height: 10,
          weight: req.weightGrams / 1000,
        }),
      },
    );
    const assigned = await providerFetch<{ response?: { data?: { awb_code?: string; courier_name?: string } } }>(
      "shiprocket",
      `${API}/courier/assign/awb`,
      { method: "POST", headers: await auth(), body: JSON.stringify({ shipment_id: created.shipment_id }) },
    );
    const awb = assigned.response?.data?.awb_code ?? null;
    return {
      providerShipmentId: String(created.shipment_id),
      awb,
      courier: assigned.response?.data?.courier_name ?? null,
      labelUrl: null,
      status: awb ? "BOOKED" : "PENDING",
    };
  }

  async track(awb: string): Promise<TrackingResult> {
    const res = await providerFetch<{
      tracking_data?: {
        shipment_track?: Array<{ current_status?: string; courier_name?: string }>;
        shipment_track_activities?: Array<{ date: string; activity: string; location?: string; "sr-status-label"?: string }>;
      };
    }>("shiprocket", `${API}/courier/track/awb/${encodeURIComponent(awb)}`, { headers: await auth() });
    const track = res.tracking_data;
    const current = track?.shipment_track?.[0];
    return {
      status: mapShiprocketStatus(current?.current_status),
      courier: current?.courier_name ?? null,
      events: (track?.shipment_track_activities ?? []).flatMap((a) => {
        const status = mapShiprocketStatus(a["sr-status-label"] ?? a.activity);
        const occurredAt = new Date(a.date);
        if (!status || Number.isNaN(occurredAt.getTime())) return [];
        return [
          {
            status,
            description: a.activity,
            location: a.location ?? null,
            occurredAt,
            externalId: `${a.date}|${a.activity}`.slice(0, 120),
          },
        ];
      }),
    };
  }
}
