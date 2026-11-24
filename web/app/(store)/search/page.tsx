import { Suspense } from "react";
import { CatalogueView } from "@/components/catalogue/CatalogueView";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LoadingState } from "@/components/ui/States";
import { getProductSummaries } from "@/lib/api/server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Search",
  description: "Search AZMARO fragrances by name, brand, note or scent family.",
  path: "/search",
  noIndex: true,
});

export default async function SearchPage() {
  return (
    <div className="az-container pt-8 sm:pt-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Search" }]} />
      <header className="mb-8">
        <h1 className="az-h1">Search the collection</h1>
        <p className="mt-3 text-sm text-ink-2">Search by fragrance name, brand, note or scent family.</p>
      </header>
      <Suspense fallback={<LoadingState />}>
        <CatalogueView
          products={await getProductSummaries()}
          layout="compact"
          showSearch
          emptyMessage="We couldn't find a fragrance for that search. Try another name, brand or a note such as oud, saffron or vanilla."
        />
      </Suspense>
    </div>
  );
}
