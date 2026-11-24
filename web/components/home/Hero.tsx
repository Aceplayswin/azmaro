import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EDITORIAL_IMAGES } from "@/data/editorial-images";

/**
 * Campaign hero with no framed image box.
 * - Phones: the photograph sits full-bleed on top and dissolves into the page; the copy follows below it,
 *   so the headline never covers the bottle.
 * - Tablet/desktop: the photograph bleeds off the right edge behind the copy and fades into the background.
 */
export function Hero() {
  const img = EDITORIAL_IMAGES.hero;

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b border-line-soft bg-bg">
      {/* Campaign photograph */}
      <div className="relative aspect-[5/4] w-full sm:absolute sm:inset-y-0 sm:right-0 sm:-z-10 sm:aspect-auto sm:w-[60%] lg:w-[64%]">
        <Image
          src={img.src}
          alt={img.alt}
          fill
          priority
          sizes="(min-width: 1024px) 64vw, (min-width: 640px) 60vw, 100vw"
          className="object-cover object-[60%_30%]"
        />
        {/* Dissolve the edges into the page so there is no visible frame */}
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-3/5 bg-gradient-to-r from-bg via-bg/75 to-transparent sm:block" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-bg/90 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg via-bg/60 to-transparent sm:h-1/3 sm:via-bg/50" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l from-bg/60 to-transparent" />
      </div>

      {/* Warm glow behind the headline so the two halves read as one scene */}
      <div className="pointer-events-none absolute top-1/2 left-0 -z-10 hidden h-[70%] w-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_left,rgba(233,202,142,0.07),transparent_70%)] sm:block" />

      <div className="az-container relative -mt-6 pb-12 sm:mt-0 sm:flex sm:min-h-[32rem] sm:items-center sm:py-16 lg:min-h-[40rem] lg:py-24">
        <div className="az-anim-rise relative sm:max-w-[50%] lg:max-w-[44%]">
          <p className="az-eyebrow">Middle Eastern fragrances</p>
          <h1 id="hero-title" className="az-display mt-4 sm:mt-7">
            The art of
            <br />
            <span className="italic text-gold-light">authentic</span> scent.
          </h1>
          <p className="mt-4 max-w-md text-[0.9rem] leading-relaxed text-ink-2 sm:mt-7 sm:text-base">
            Discover a considered collection of Middle Eastern perfumery – from everyday signatures to statement-making blends.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/shop" className="group">
              Shop all
              <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/brands" variant="secondary" className="max-sm:hidden">
              Explore brands
              <ArrowRight className="size-3.5" aria-hidden />
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
