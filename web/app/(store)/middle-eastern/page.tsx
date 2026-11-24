import { Suspense } from "react";
import { CatalogueView } from "@/components/catalogue/CatalogueView";
import { EditorialArtwork } from "@/components/ui/Artwork";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LoadingState } from "@/components/ui/States";
import { siteConfig } from "@/config/site";
import { EDITORIAL_IMAGES } from "@/data/editorial-images";
import { getProductSummaries } from "@/lib/api/server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Middle Eastern fragrances",
  description:
    "Explore oud, amber, musk, rose, woods and modern aromatic compositions from Middle Eastern fragrance houses.",
  path: "/middle-eastern",
});

export default async function MiddleEasternPage() {
  // AZMARO has one top-level collection; scent families are filters within it.
  const products = await getProductSummaries();
  return (
    <>
      <div className="az-container pt-6">
        <EditorialArtwork
          slot="Category campaign image · supplied by AZMARO"
          motif="star"
          images={[...EDITORIAL_IMAGES.middleEastern]}
          sizes="20vw"
          priority
          className="h-44 border border-line-soft sm:h-60 lg:h-72"
        />
      </div>
      <div className="az-container pt-8 sm:pt-12">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Middle Eastern" }]} />
        <header className="mb-8 max-w-3xl sm:mb-10">
          <p className="az-eyebrow mb-3">The collection</p>
          <h1 className="az-h1">Middle Eastern fragrances</h1>
          <p className="mt-4 text-sm text-ink-2 sm:text-[0.95rem]">
            Explore oud, amber, musk, rose, woods and modern aromatic compositions from Middle Eastern fragrance houses.
          </p>
        </header>
        <Suspense fallback={<LoadingState label="Loading the collection" />}>
          <CatalogueView products={products} layout="chips" pageSize={siteConfig.catalogue.pageSize} />
        </Suspense>
      </div>
    </>
  );
}
