/**
 * Editorial merchandising choices (not sales rankings – there are no
 * bestseller claims anywhere).
 */
export const merchandising = {
  /** "Curated for you" selection, in display order. */
  featuredSlugs: [
    "khamrah-qahwa",
    "ameer-al-oud-intense",
    "club-de-nuit-untold",
    "amber-oud-ruby-edition",
    "balase-rose",
    "faris-al-arab",
    "yara-moi",
    "tribute-blue",
  ],
  /** Houses highlighted on the homepage; the first is the directory's featured house. */
  featuredBrandIds: ["lattafa", "armaf", "al-haramain", "rasasi", "ibrahim-al-qurashi", "maison-asrar"],
} as const;
