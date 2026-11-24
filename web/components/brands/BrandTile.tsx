import Image from "next/image";
import Link from "next/link";
import { BRAND_TILE_IMAGES } from "@/data/editorial-images";
import type { BrandWithCount } from "@/types/catalogue";
import { cn, pluralise } from "@/lib/utils";

/**
 * Brand tile – approved brand artwork (logo) when supplied; otherwise one of the
 * brand's own bottle photographs behind the typographic wordmark.
 */
export function BrandTile({ brand, className }: { brand: BrandWithCount; className?: string }) {
  const photo = brand.image ? null : BRAND_TILE_IMAGES[brand.slug];
  return (
    <Link
      href={`/brands/${brand.slug}`}
      className={cn(
        "group relative isolate flex min-h-32 flex-col items-center justify-center overflow-hidden border border-line-soft bg-card px-4 py-7 text-center transition-colors duration-500 hover:border-line hover:bg-elevated",
        photo && "min-h-44 justify-end sm:min-h-52",
        className,
      )}
    >
      {photo && (
        <>
          <Image
            src={photo}
            alt=""
            fill
            sizes="(min-width: 1024px) 17vw, (min-width: 768px) 33vw, 50vw"
            className="-z-10 object-cover opacity-85 transition-[transform,opacity] duration-[900ms] ease-[var(--az-ease)] group-hover:scale-[1.06] group-hover:opacity-100"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-bg/35 to-transparent" aria-hidden />
        </>
      )}
      {brand.image ? (
        <Image src={brand.image} alt={`${brand.name} logo`} width={160} height={60} className="h-12 w-auto object-contain" />
      ) : (
        <span className="font-serif text-xl tracking-[0.12em] text-ink uppercase transition-colors group-hover:text-gold-light sm:text-[1.35rem]">
          {brand.name}
        </span>
      )}
      <span className="mt-3 text-[0.6rem] font-bold tracking-[0.2em] text-gold uppercase">
        {pluralise(brand.productCount, "fragrance")}
      </span>
    </Link>
  );
}
