/** Display helpers and labels shared by admin pages. */

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_PAYMENT: { label: "Awaiting payment", cls: "badge-warn" },
  PLACED: { label: "Placed", cls: "badge-info" },
  CONFIRMED: { label: "Confirmed", cls: "badge-info" },
  PROCESSING: { label: "Processing", cls: "badge-info" },
  SHIPPED: { label: "Shipped", cls: "badge-info" },
  DELIVERED: { label: "Delivered", cls: "badge-ok" },
  CANCELLED: { label: "Cancelled", cls: "badge-bad" },
  RETURNED: { label: "Returned", cls: "badge-bad" },
};

export const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  NOT_COLLECTED: { label: "Not collected (test)", cls: "" },
  PENDING: { label: "Pending", cls: "badge-warn" },
  AUTHORIZED: { label: "Authorised", cls: "badge-info" },
  PAID: { label: "Paid", cls: "badge-ok" },
  FAILED: { label: "Failed", cls: "badge-bad" },
  COD_PENDING: { label: "COD – to collect", cls: "badge-warn" },
  REFUND_PENDING: { label: "Refund pending", cls: "badge-warn" },
  REFUNDED: { label: "Refunded", cls: "" },
  CANCELLED: { label: "Cancelled", cls: "" },
};

export const PAYMENT_METHOD: Record<string, string> = { UPI: "UPI", CARD: "Card", NETBANKING: "Net banking", COD: "Cash on delivery" };

export const SHIPMENT_STATUS: Record<string, string> = {
  PENDING: "Pending",
  BOOKED: "Booked",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  RETURN_TO_ORIGIN: "Returned to origin",
  CANCELLED: "Cancelled",
  EXCEPTION: "Exception",
};

/** Manual status changes the API allows (mirrors ORDER_TRANSITIONS in the API). */
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ["PLACED", "CANCELLED"],
  PLACED: ["CONFIRMED", "PROCESSING", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "SHIPPED", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export function StatusBadge({ map, value }: { map: Record<string, { label: string; cls: string }>; value: string }) {
  const s = map[value] ?? { label: value, cls: "" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
