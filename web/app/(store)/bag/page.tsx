import { BagView } from "@/components/cart/BagView";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getProductSummaries } from "@/lib/api/server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Shopping bag",
  description: "Review your AZMARO selection before checkout.",
  path: "/bag",
  noIndex: true,
});

export default async function BagPage() {
  return (
    <div className="az-container pt-8 sm:pt-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shopping bag" }]} />
      <header className="mb-8 sm:mb-10">
        <h1 className="az-h1">Shopping bag</h1>
        <p className="mt-3 text-sm text-ink-2">Review your selection before checkout.</p>
      </header>
      <BagView products={await getProductSummaries()} />
    </div>
  );
}
