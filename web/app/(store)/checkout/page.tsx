import { CheckoutView } from "@/components/checkout/CheckoutView";
import type { PaymentMethod } from "@/types/api";
import { getIntegrationStatus, getProductSummaries } from "@/lib/api/server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Secure checkout",
  description: "Complete your AZMARO order.",
  path: "/checkout",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [products, status] = await Promise.all([getProductSummaries(), getIntegrationStatus()]);
  const testMode = status.mode === "demo" && !status.payments.configured;
  // Offer only methods the API can actually take: online needs a connected gateway, COD follows admin settings.
  const p = status.payments;
  const online = (p.onlineAvailable ?? false) ? (p.onlineMethods ?? ["UPI", "CARD", "NETBANKING"]).map((m) => m.toLowerCase() as PaymentMethod) : [];
  const availableMethods: PaymentMethod[] = [...online, ...((p.codEnabled ?? true) ? (["cod"] as const) : [])];
  return (
    <div className="az-container pt-8 sm:pt-12">
      <header className="mb-8">
        <h1 className="az-h1">Secure checkout</h1>
      </header>
      <CheckoutView products={products} testMode={testMode} availableMethods={availableMethods} />
    </div>
  );
}
