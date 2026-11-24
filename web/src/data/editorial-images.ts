import type { EditorialImage } from "@/components/ui/Artwork";

/**
 * Editorial slots filled with real AZMARO catalogue product photography
 * (only images approved in the catalogue – see API/db/seed-data/product-images.ts).
 * Replace with dedicated campaign photography when it is supplied.
 */
const p = (slug: string, ext: string, alt: string, position?: string): EditorialImage => ({
  src: `/images/products/${slug}.${ext}`,
  alt,
  position,
});

export const EDITORIAL_IMAGES = {
  // Supplied AZMARO campaign image.
  hero: {
    src: "/images/campaigns/hero.webp",
    alt: "Gold perfume bottle with a pearl stopper on black marble in warm golden light",
    position: "50% 10%",
  },
  edit: p("oud-mood-elixir", "jpg", "Lattafa Oud Mood Elixir on gold satin"),
  aboutStory: [
    p("ameer-al-oud-intense", "webp", "Lattafa Ameer Al Oud Intense in smoke"),
    p("dirham-oud", "webp", "Ard Al Zaafaran Dirham Oud with warm leather and wood"),
    p("oud-mood-reminiscence", "webp", "Lattafa Oud Mood Reminiscence on stone and gold"),
    p("cuban-tobacco", "webp", "Ibrahim Al Qurashi Cuban Tobacco among smoky ingredients"),
  ],
  aboutEditorial: p("teriaq", "webp", "Lattafa Teriaq in an arched Middle Eastern interior"),
  middleEastern: [
    p("hawas-elixir", "webp", "Rasasi Hawas Elixir"),
    p("ameer-al-oud-intense", "webp", "Lattafa Ameer Al Oud Intense in smoke"),
    p("andaleeb", "webp", "Asdaaf Andaleeb"),
    p("thriller", "webp", "Maison Asrar Thriller"),
    p("hawas-majestic", "webp", "Rasasi Hawas Majestic"),
  ],
} as const;

/**
 * One representative approved bottle photograph per brand, used as the brand tile
 * backdrop until official brand artwork / logos are supplied (Brand.image).
 */
export const BRAND_TILE_IMAGES: Record<string, string> = {
  afnan: "/images/products/tribute-blue.webp",
  "al-haramain": "/images/products/amber-oud-gold.webp",
  "ard-al-zaafaran": "/images/products/dirham-oud.webp",
  armaf: "/images/products/club-de-nuit-untold.webp",
  aromatix: "/images/products/tease-me.webp",
  asdaaf: "/images/products/andaleeb.webp",
  "french-avenue": "/images/products/liquid-brun.avif",
  "ibrahim-al-qurashi": "/images/products/cullinan-diamond-iris.webp",
  lattafa: "/images/products/khamrah-qahwa.webp",
  luscious: "/images/products/vulcan-sable.webp",
  "maison-alhambra": "/images/products/smoky.webp",
  "maison-asrar": "/images/products/thriller.webp",
  rasasi: "/images/products/hawas-elixir.webp",
  rayhaan: "/images/products/imperia.webp",
  zimaya: "/images/products/fatima.jpg",
};
