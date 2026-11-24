import type { Metadata } from "next";

/** Page-level metadata with canonical URL and Open Graph defaults. */
export function pageMetadata({
  title,
  description,
  path,
  noIndex,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} | AZMARO`, description, url: path },
    robots: noIndex ? { index: false, follow: true } : undefined,
  };
}
