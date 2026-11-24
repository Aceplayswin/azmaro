import { AzmaroEdit } from "@/components/home/AzmaroEdit";
import { Hero } from "@/components/home/Hero";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { ScentFamilies } from "@/components/home/ScentFamilies";
import { TrustMarkers } from "@/components/home/TrustMarkers";
import { BrandTile } from "@/components/brands/BrandTile";
import { ProductCard } from "@/components/products/ProductCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getFeaturedBrands, getFeaturedProducts, getProductSummaries } from "@/lib/api/server";

export default async function HomePage() {
  const [featuredAll, summaries, featuredBrands] = await Promise.all([
    getFeaturedProducts(),
    getProductSummaries(),
    getFeaturedBrands(),
  ]);
  const featured = featuredAll.slice(0, 5);
  const familyCounts: Record<string, number> = {};
  for (const p of summaries) for (const f of p.scentFamilies) familyCounts[f] = (familyCounts[f] ?? 0) + 1;

  return (
    <>
      <Hero />
      <TrustMarkers />
      <ScentFamilies counts={familyCounts} />

      <section aria-labelledby="curated-title" className="az-container pt-16 sm:pt-20">
        <SectionHeading id="curated-title" eyebrow="Curated for you" title="Featured fragrances" action={{ label: "Shop all", href: "/shop" }} />
        <ul className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-4 xl:grid-cols-5">
          {featured.map((p, i) => (
            <li key={p.slug} className={i === 4 ? "hidden xl:block" : undefined}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      </section>

      <AzmaroEdit />

      {featuredBrands.length > 0 && (
        <section aria-labelledby="houses-title" className="az-container pt-16 sm:pt-20">
          <SectionHeading id="houses-title" eyebrow="The houses" title="Fragrance houses" action={{ label: "All brands", href: "/brands" }} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
            {featuredBrands.map((b) => (
              <BrandTile key={b.id} brand={b} />
            ))}
          </div>
        </section>
      )}

      <NewsletterForm />
    </>
  );
}
