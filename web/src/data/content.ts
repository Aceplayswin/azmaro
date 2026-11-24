/**
 * Editable brand copy. Anything set to `null` is awaiting founder approval and
 * is not rendered on the public site (a placeholder shows in development only).
 * Do not add heritage, sourcing partnerships, certifications or guarantees here
 * unless AZMARO has approved and can substantiate them.
 */
export const content = {
  about: {
    headline: "A more personal way to discover fragrance.",
    /** Founder-approved brand story paragraphs. */
    story: null as string[] | null,
    /** Neutral summary shown until the founder story is supplied – factual scope only. */
    fallbackSummary:
      "AZMARO brings together a focused collection of Middle Eastern fragrance houses for customers across India, presented with clear product information so every choice is an informed one.",
    principles: [
      { title: "Authenticity", body: "Genuine products, sourced through trusted channels." },
      { title: "Curation", body: "A focused selection of Middle Eastern fragrance houses." },
      { title: "Service", body: "Clear information, tracked delivery and real support." },
    ],
  },
  policies: {
    /** Approved policy text (markdown-free paragraphs). Null = awaiting approval. */
    shipping: null as string[] | null,
    returns: null as string[] | null,
    privacy: null as string[] | null,
    terms: null as string[] | null,
  },
};
