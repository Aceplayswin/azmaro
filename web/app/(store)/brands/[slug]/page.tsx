import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogueView } from "@/components/catalogue/CatalogueView";
import { EditorialArtwork } from "@/components/ui/Artwork";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LoadingState } from "@/components/ui/States";
import { getBrandDetail } from "@/lib/api/server";
import { pageMetadata } from "@/lib/seo";
import { pluralise } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/brands/[slug]">) {
  const { slug } = await params;
  const brand = (await getBrandDetail(slug))?.brand;
  if (!brand) return {};
  return pageMetadata({
    title: `${brand.name} fragrances`,
    description: `Shop ${pluralise(brand.productCount, "fragrance")} from ${brand.name} at AZMARO – authentic Middle Eastern perfumery delivered across India.`,
    path: `/brands/${brand.slug}`,
  });
}

export default async function BrandPage({ params }: PageProps<"/brands/[slug]">) {
  const { slug } = await params;
  const detail = await getBrandDetail(slug);
  if (!detail) notFound();
  const { brand, products } = detail;
  const photos = products.flatMap((p) => (p.image ? [{ src: p.image.src, alt: p.image.alt }] : [])).slice(0, 4);

  return (
    <>
      <div className="az-container pt-6">
        <EditorialArtwork slot="Brand campaign image · approved brand photography only" motif="wordmark" images={photos} sizes={photos.length > 1 ? "25vw" : "100vw"} priority className="h-44 border border-line-soft sm:h-60" />
      </div>
      <div className="az-container pt-8 sm:pt-12">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Brands", href: "/brands" }, { label: brand.name }]} />
        <header className="mb-10 max-w-3xl">
          <p className="az-eyebrow mb-3">The house</p>
          <h1 className="az-h1 tracking-[0.04em] uppercase">{brand.name}</h1>
          {brand.description ? (
            <p className="mt-4 text-sm text-ink-2 sm:text-[0.95rem]">{brand.description}</p>
          ) : (
            <p className="mt-4 text-sm text-ink-2 sm:text-[0.95rem]">
              {pluralise(brand.productCount, "fragrance")} from {brand.name} in the AZMARO Middle Eastern collection.
            </p>
          )}
        </header>
        <Suspense fallback={<LoadingState />}>
          <CatalogueView products={products} layout="compact" hide={["brand"]} />
        </Suspense>
      </div>
    </>
  );
}
