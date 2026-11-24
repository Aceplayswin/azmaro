import { EditorialArtwork } from "@/components/ui/Artwork";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Notice } from "@/components/ui/States";
import { content } from "@/data/content";
import { EDITORIAL_IMAGES } from "@/data/editorial-images";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About AZMARO",
  description: "AZMARO curates authentic Middle Eastern fragrances for customers across India.",
  path: "/about",
});

export default function AboutPage() {
  const { about } = content;
  return (
    <>
      <div className="az-container pt-6">
        <EditorialArtwork
          slot="Brand story image · real campaign, sourcing or packaging photography"
          motif="wordmark"
          images={[...EDITORIAL_IMAGES.aboutStory]}
          sizes="(min-width: 640px) 25vw, 50vw"
          priority
          className="h-56 border border-line-soft sm:h-72 lg:h-96"
        />
      </div>

      <section className="az-container grid gap-10 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16" aria-labelledby="about-title">
        <div className="flex flex-col justify-center">
          <p className="az-eyebrow">About AZMARO</p>
          <h1 id="about-title" className="az-h1 mt-5">
            {about.headline}
          </h1>
          <div className="mt-6 space-y-4 text-[0.95rem] leading-relaxed text-ink-2">
            {about.story ? about.story.map((p) => <p key={p.slice(0, 24)}>{p}</p>) : <p>{about.fallbackSummary}</p>}
          </div>
          {!about.story && process.env.NODE_ENV === "development" && (
            <Notice tone="demo" className="mt-6" title="Content placeholder">
              Add the founder-approved brand story in src/data/content.ts (about.story).
            </Notice>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/middle-eastern">Explore the collection</ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Talk to us
            </ButtonLink>
          </div>
        </div>
        <EditorialArtwork slot="Editorial image · real packaging / material / store photography" motif="arch" images={[EDITORIAL_IMAGES.aboutEditorial]} sizes="(min-width: 1024px) 45vw, 100vw" className="min-h-72 border border-line-soft lg:min-h-[28rem]" />
      </section>

      <section className="az-container pt-20" aria-labelledby="principles-title">
        <SectionHeading id="principles-title" eyebrow="What we stand for" title="Our principles" />
        <ol className="grid gap-4 md:grid-cols-3">
          {about.principles.map((p, i) => (
            <li key={p.title} className="az-panel flex gap-5 p-7">
              <span className="font-serif text-2xl text-gold">0{i + 1}</span>
              <div>
                <h3 className="font-sans text-[0.7rem] font-bold tracking-[0.22em] text-gold-light uppercase">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">{p.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
