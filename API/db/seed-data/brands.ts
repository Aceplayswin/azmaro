/**
 * Fragrance houses represented in the AZMARO catalogue.
 *
 * `description` and `image` are admin-managed and intentionally null until
 * AZMARO supplies approved copy and artwork. Do not add heritage claims here.
 */
import type { Brand } from "./types";

const brand = (id: string, name: string): Brand => ({
  id,
  slug: id,
  name,
  description: null,
  image: null,
  isPublished: true,
});

export const BRANDS: Brand[] = [
  brand("afnan", "Afnan"),
  brand("al-haramain", "Al Haramain"),
  brand("ard-al-zaafaran", "Ard Al Zaafaran"),
  brand("armaf", "Armaf"),
  brand("aromatix", "Aromatix"),
  brand("asdaaf", "Asdaaf"),
  brand("french-avenue", "French Avenue"),
  brand("ibrahim-al-qurashi", "Ibrahim Al Qurashi"),
  brand("lattafa", "Lattafa"),
  brand("luscious", "Luscious"),
  brand("maison-alhambra", "Maison Alhambra"),
  brand("maison-asrar", "Maison Asrar"),
  brand("rasasi", "Rasasi"),
  brand("rayhaan", "Rayhaan"),
  brand("zimaya", "Zimaya"),
];
