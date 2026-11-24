import { Suspense } from "react";
import { CatalogueView } from "@/components/catalogue/CatalogueView";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LoadingState } from "@/components/ui/States";
import { siteConfig } from "@/config/site";
import { getProductSummaries } from "@/lib/api/server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Shop all fragrances",
  description: "A considered edit of authentic Middle Eastern perfumery. Filter by scent family, brand, concentration and size.",
  path: "/shop",
});

export default async function ShopPage() {
  const products = await getProductSummaries();
  return (
    <div className="az-container pt-8 pb-4 sm:pt-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop all" }]} />
      <header className="mb-10 sm:mb-12">
        <h1 className="az-h1">Shop all fragrances</h1>
        <p className="mt-3 text-sm text-ink-2 sm:text-[0.95rem]">A considered edit of authentic Middle Eastern perfumery.</p>
      </header>
      <Suspense fallback={<LoadingState label="Loading the collection" />}>
        <CatalogueView products={products} layout="sidebar" showSearch pageSize={siteConfig.catalogue.pageSize} />
      </Suspense>
    </div>
  );
}
