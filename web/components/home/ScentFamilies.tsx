import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScentMotif } from "@/components/ui/Artwork";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SCENT_FAMILIES } from "@/data/scent-families";

const TINTS: Record<string, string> = {
  "oud-woods": "from-[#2a1a0e]",
  "amber-gourmand": "from-[#3a220b]",
  "musk-clean": "from-[#24201b]",
  "rose-floral": "from-[#311a1a]",
  "fresh-aromatic": "from-[#1c2116]",
};

export function ScentFamilies({ counts }: { counts: Record<string, number> }) {
  return (
    <section aria-labelledby="scent-title" className="az-container pt-16 sm:pt-20">
      <SectionHeading id="scent-title" eyebrow="Discover by scent" title="Find your next signature." description="Browse the Middle Eastern collection by fragrance family." />
      {/* Phones: swipeable row of square tiles (next tile peeks in) so the bottle photos are never cropped.
          Tablet (md): 6-track grid, 3 tiles then 2 wider tiles (no orphans). Desktop: 5 across. */}
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:-mx-7 sm:scroll-px-7 sm:px-7 md:mx-0 md:grid md:grid-cols-6 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-5">
        {SCENT_FAMILIES.map((family, i) => (
          <li key={family.id} className={`flex w-[72%] shrink-0 snap-start sm:w-[44%] md:w-auto ${i < 3 ? "md:col-span-2" : "md:col-span-3"} lg:col-span-1`}>
            <Link
              href={`/middle-eastern?family=${family.id}`}
              className="group flex w-full flex-col border border-line-soft bg-card transition-colors duration-500 hover:border-line"
            >
              <div
                className={`relative overflow-hidden bg-gradient-to-br ${TINTS[family.id]} to-bg aspect-square md:aspect-[4/3]`}
              >
                {family.image ? (
                  <Image src={family.image} alt="" fill sizes="(min-width:1024px) 20vw, (min-width:640px) 50vw, 75vw" className="object-cover transition-transform duration-[900ms] group-hover:scale-105" />
                ) : (
                  <>
                    <div className="az-lattice absolute inset-0 opacity-50" />
                    <ScentMotif
                      family={family.id}
                      className="absolute top-1/2 left-1/2 size-28 -translate-x-1/2 -translate-y-1/2 text-gold/70 transition-transform duration-[900ms] group-hover:scale-110 sm:size-32"
                    />
                  </>
                )}
                <div className="absolute inset-0 bg-gold/0 transition-colors duration-500 group-hover:bg-gold/[0.06]" />
              </div>
              <div className="flex flex-1 items-end justify-between gap-3 px-4 py-4">
                <div>
                  <h3 className="font-sans text-[0.7rem] font-bold tracking-[0.2em] text-ink uppercase">{family.label}</h3>
                  <p className="mt-1 text-[0.7rem] text-muted">{counts[family.id] ?? 0} fragrances</p>
                </div>
                <span className="az-link inline-flex items-center gap-1.5 text-[0.6rem]">
                  Explore
                  <ArrowRight className="size-3 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
