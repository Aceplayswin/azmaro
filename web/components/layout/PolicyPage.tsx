import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export function PolicyPage({ title, paragraphs }: { title: string; paragraphs: string[] | null }) {
  return (
    <div className="az-container max-w-3xl pt-8 sm:pt-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />
      <h1 className="az-h1">{title}</h1>
      <div className="mt-8 space-y-4 text-[0.95rem] leading-relaxed text-ink-2">
        {paragraphs ? (
          paragraphs.map((p) => <p key={p.slice(0, 30)}>{p}</p>)
        ) : (
          <p>
            Our {title.toLowerCase()} is being finalised and will be published here before launch. If you have any questions in the
            meantime, please{" "}
            <Link href="/contact" className="text-gold underline-offset-4 hover:underline">
              contact us
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
