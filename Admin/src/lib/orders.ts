/** Admin order shape (GET /admin/orders, /admin/orders/:id). */

export interface ShipmentEvent {
  id: string;
  status: string;
  description: string;
  location: string | null;
  occurredAt: string;
  source: "COURIER" | "ADMIN" | "SYSTEM";
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  isTest: boolean;
  email: string;
  phone: string;
  items: Array<{ productSlug: string; productName: string; brandName: string; sizeMl: number; sku: string | null; unitPrice: number; quantity: number; lineTotal: number }>;
  totals: { subtotal: number; discount: number; delivery: number | null; total: number; currency: string };
  couponCode: string | null;
  shippingAddress: { fullName: string; phone: string; line1: string; line2: string | null; landmark: string | null; city: string; state: string; pin: string };
  customerNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  customer: { id: string; name: string; email: string } | null;
  payments: Array<{
    id: string;
    provider: string;
    method: string;
    status: string;
    amount: number | null;
    providerOrderId: string | null;
    providerPaymentId: string | null;
    providerStatus: string | null;
    failureReason: string | null;
    isTest: boolean;
    createdAt: string;
  }>;
  shipments: Array<{ id: string; provider: string; courier: string | null; awb: string | null; status: string; labelUrl: string | null; events: ShipmentEvent[] }>;
  statusHistory: Array<{ id: string; status: string; note: string | null; actor: string; createdAt: string }>;
}
