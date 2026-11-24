import { BrandDirectory } from "@/components/brands/BrandDirectory";
import { EditorialArtwork } from "@/components/ui/Artwork";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getBrandDetail, getBrands, getFeaturedBrands } from "@/lib/api/server";
import { pageMetadata } from "@/lib/seo";
import { pluralise } from "@/lib/utils";

export const metadata = pageMetadata({
  title: "Fragrance houses",
  description: "Discover the houses behind the scents. Browse the AZMARO edit by brand.",
  path: "/brands",
});

export default async function BrandsPage() {
  const [brands, featuredBrands] = await Promise.all([getBrands(), getFeaturedBrands()]);
  const featured = featuredBrands[0] ?? brands[0];
  const featuredPhotos = featured
    ? ((await getBrandDetail(featured.slug))?.products ?? [])
        .flatMap((p) => (p.image ? [{ src: p.image.src, alt: p.image.alt }] : []))
        .slice(0, 2)
    : [];

  return (
    <div className="az-container pt-8 sm:pt-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Brands" }]} />
      <header className="mb-10">
        <h1 className="az-h1">Fragrance houses</h1>
        <p className="mt-3 text-sm text-ink-2 sm:text-[0.95rem]">
          Discover the houses behind the scents. Browse the AZMARO edit by brand.
        </p>
      </header>

      {featured && (
        <section aria-labelledby="featured-house" className="mb-14 grid overflow-hidden border border-line-soft bg-card md:grid-cols-2">
          <EditorialArtwork slot="Featured brand image · approved brand still / logo lock-up" motif="wordmark" images={featuredPhotos} sizes="25vw" className="min-h-56 md:min-h-80" />
          <div className="flex flex-col justify-center p-7 sm:p-10">
            <p className="az-eyebrow">Featured house</p>
            <h2 id="featured-house" className="mt-4 font-serif text-4xl tracking-[0.06em] uppercase sm:text-5xl">
              {featured.name}
            </h2>
            <p className="mt-4 text-sm text-ink-2">
              {featured.description ??
                `${pluralise(featured.productCount, "fragrance")} from ${featured.name} in the AZMARO collection.`}
            </p>
            <ButtonLink href={`/brands/${featured.slug}`} variant="secondary" className="mt-8 self-start">
              View brand collection
            </ButtonLink>
          </div>
        </section>
      )}

      <SectionHeading title="All brands" description={`${pluralise(brands.length, "house")} in the collection.`} />
      <BrandDirectory brands={brands} />
    </div>
  );
}
