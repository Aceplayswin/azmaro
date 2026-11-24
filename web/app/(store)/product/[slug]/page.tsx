import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductGallery } from "@/components/products/ProductGallery";
import { ProductInfo } from "@/components/products/ProductInfo";
import { ProductPurchasePanel } from "@/components/products/ProductPurchasePanel";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { siteConfig } from "@/config/site";
import { CONCENTRATION_LABELS, GENDER_LABELS } from "@/lib/catalogue/filter";
import { getProductDetail } from "@/lib/api/server";
import type { Product } from "@/types/catalogue";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const product = (await getProductDetail(slug))?.product;
  if (!product) return {};
  const description = (product.description ?? `${product.name} by ${product.brandName}. ${product.scentCharacter}.`).slice(0, 158);
  return {
    title: `${product.name} by ${product.brandName}`,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: `${product.name} by ${product.brandName} | AZMARO`,
      description,
      url: `/product/${product.slug}`,
      images: product.images[0] ? [{ url: product.images[0].src, alt: product.images[0].alt }] : undefined,
    },
  };
}

/** Structured data is emitted only when price AND availability are verified. */
function productJsonLd(p: Product) {
  const offers = p.variants.filter((v) => v.price !== null && v.stockStatus !== null);
  if (!offers.length || !p.images.length) return null;
  const availability = {
    in_stock: "InStock",
    low_stock: "LimitedAvailability",
    out_of_stock: "OutOfStock",
    preorder: "PreOrder",
  } as const;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    brand: { "@type": "Brand", name: p.brandName },
    description: p.description ?? undefined,
    image: p.images.map((i) => new URL(i.src, siteConfig.url).toString()),
    offers: offers.map((v) => ({
      "@type": "Offer",
      priceCurrency: "INR",
      price: v.price,
      sku: v.sku ?? undefined,
      availability: `https://schema.org/${availability[v.stockStatus!]}`,
      url: new URL(`/product/${p.slug}`, siteConfig.url).toString(),
    })),
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const detail = await getProductDetail(slug);
  if (!detail) notFound();
  const { product, summary, related } = detail;
  const jsonLd = productJsonLd(product);
  const meta = [
    product.concentration ? CONCENTRATION_LABELS[product.concentration] : null,
    product.gender ? GENDER_LABELS[product.gender] : null,
  ].filter(Boolean);

  return (
    <div className="pb-24 lg:pb-0">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <div className="az-container pt-6 sm:pt-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
            { label: product.brandName, href: `/brands/${product.brandId}` },
            { label: product.name },
          ]}
        />

        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8 lg:gap-14 xl:gap-20">
          <div className="md:sticky md:top-[calc(var(--az-header-h)+1.5rem)] md:self-start">
            <ProductGallery images={product.images} brandName={product.brandName} name={product.name} />
          </div>

          <div className="min-w-0">
            <Link href={`/brands/${product.brandId}`} className="az-eyebrow hover:text-gold-light">
              {product.brandLabel}
            </Link>
            <h1 className="mt-3 font-serif text-[2.4rem] leading-[1.05] sm:text-5xl">{product.name}</h1>
            {meta.length > 0 && (
              <p className="mt-3 text-[0.65rem] font-bold tracking-[0.2em] text-ink-2 uppercase">{meta.join("  /  ")}</p>
            )}
            <p className="mt-5 text-[0.95rem] leading-relaxed text-ink-2">{product.scentCharacter}</p>

            <div className="mt-8">
              <ProductPurchasePanel product={summary} />
            </div>

            <div className="mt-10">
              <ProductInfo product={product} />
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="az-container pt-20">
          <SectionHeading id="related-title" eyebrow="You may also like" title="Related fragrances" />
          <ul className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-4">
            {related.map((p) => (
              <li key={p.slug}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
