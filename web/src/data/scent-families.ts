import type { ScentFamily } from "@/types/catalogue";

/**
 * Discovery filters within the single Middle Eastern collection.
 * These are NOT separate business categories.
 * `image` is a representative approved product photograph from that family
 * (replace with dedicated editorial crops when supplied).
 */
export const SCENT_FAMILIES: ScentFamily[] = [
  {
    id: "oud-woods",
    label: "Oud & Woods",
    shortLabel: "Oud",
    blurb: "Resinous oud, smoky incense and polished woods.",
    image: "/images/products/dirham-oud.webp",
  },
  {
    id: "amber-gourmand",
    label: "Amber & Gourmand",
    shortLabel: "Amber",
    blurb: "Warm amber, vanilla, coffee and dessert-like sweetness.",
    image: "/images/products/liquid-brun.avif",
  },
  {
    id: "musk-clean",
    label: "Musk & Clean",
    shortLabel: "Musk",
    blurb: "Soft musks and clean, skin-close dry-downs.",
    image: "/images/products/velvet-musk.webp",
  },
  {
    id: "rose-floral",
    label: "Rose & Floral",
    shortLabel: "Rose",
    blurb: "Rose, white florals and fruity-floral bouquets.",
    image: "/images/products/pink-velvet.webp",
  },
  {
    id: "fresh-aromatic",
    label: "Fresh & Aromatic",
    shortLabel: "Fresh",
    blurb: "Citrus, aromatic herbs and airy, watery accords.",
    image: "/images/products/ocean-rush.webp",
  },
];

export const SCENT_FAMILY_MAP = Object.fromEntries(SCENT_FAMILIES.map((f) => [f.id, f])) as Record<
  ScentFamily["id"],
  ScentFamily
>;
