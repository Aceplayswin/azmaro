import { Suspense } from "react";
import { TrackOrderForm } from "@/components/tracking/TrackOrderForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LoadingState } from "@/components/ui/States";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Track your order",
  description: "Enter your AZMARO order number and contact details to view the latest shipment status.",
  path: "/track-order",
});

export default function TrackOrderPage() {
  return (
    <div className="az-container pt-8 sm:pt-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Track order" }]} />
      <header className="mb-10">
        <h1 className="az-h1">Track your order</h1>
        <p className="mt-3 text-sm text-ink-2">Enter your order number and contact details to view the latest shipment status.</p>
      </header>
      <Suspense fallback={<LoadingState />}>
        <TrackOrderForm />
      </Suspense>
    </div>
  );
}
