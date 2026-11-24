import { Suspense } from "react";
import { OrderConfirmation } from "@/components/checkout/OrderConfirmation";
import { LoadingState } from "@/components/ui/States";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Order confirmation",
  description: "Your AZMARO order confirmation.",
  path: "/checkout/confirmation",
  noIndex: true,
});

export default function ConfirmationPage() {
  return (
    <div className="az-container pt-12 sm:pt-16">
      <Suspense fallback={<LoadingState />}>
        <OrderConfirmation />
      </Suspense>
    </div>
  );
}
