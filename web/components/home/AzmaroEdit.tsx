import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EditorialArtwork } from "@/components/ui/Artwork";
import { EDITORIAL_IMAGES } from "@/data/editorial-images";

export function AzmaroEdit() {
  return (
    <section aria-labelledby="edit-title" className="az-container pt-16 sm:pt-20">
      <div className="grid overflow-hidden border border-line-soft bg-card md:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
          <p className="az-eyebrow">The AZMARO edit</p>
          <h2 id="edit-title" className="az-h2 mt-4">
            A fragrance wardrobe, thoughtfully chosen.
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-ink-2">
            Discover Middle Eastern fragrance houses, signature notes and modern compositions – each presented with clear
            product guidance, so you can choose by mood, occasion and season.
          </p>
          <Link href="/middle-eastern" className="az-link group mt-8 inline-flex items-center gap-2 self-start">
            Explore the collection
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
        <EditorialArtwork slot="Editorial campaign image" motif="arch" images={[EDITORIAL_IMAGES.edit]} sizes="(min-width: 768px) 45vw, 100vw" className="min-h-72 border-t border-line-soft md:border-t-0 md:border-l" />
      </div>
    </section>
  );
}
