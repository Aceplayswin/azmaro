import type { ProductCardRow } from "./catalogue.mapper";

/**
 * Search relevance. Every query term must match a real catalogue field; notes
 * are only searched when the profile has a published (verified) pyramid.
 */
export const SCENT_SYNONYMS: Record<string, string> = {
  oud: "oud-woods",
  wood: "oud-woods",
  woods: "oud-woods",
  woody: "oud-woods",
  amber: "amber-gourmand",
  gourmand: "amber-gourmand",
  vanilla: "amber-gourmand",
  sweet: "amber-gourmand",
  musk: "musk-clean",
  musky: "musk-clean",
  clean: "musk-clean",
  rose: "rose-floral",
  floral: "rose-floral",
  fresh: "fresh-aromatic",
  aromatic: "fresh-aromatic",
  citrus: "fresh-aromatic",
  aquatic: "fresh-aromatic",
};

export const normalise = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const searchTerms = (q: string) =>
  normalise(q)
    .split(/\s+/)
    .map((t) => t.replace(/[%_\\]/g, ""))
    .filter((t) => t.length > 0)
    .slice(0, 6);

export function scoreProduct(p: Pick<ProductCardRow, "name" | "brandLabel" | "brand" | "noteBasis" | "fragranceFamily" | "scentCharacter" | "categories"> & { topNotes?: string; heartNotes?: string; baseNotes?: string }, terms: string[]): number {
  const name = normalise(p.name);
  const brand = normalise(`${p.brand.name} ${p.brandLabel}`);
  const notes = normalise(`${p.topNotes ?? ""} ${p.heartNotes ?? ""} ${p.baseNotes ?? ""}`);
  const family = normalise(`${p.fragranceFamily} ${p.scentCharacter}`);
  const families = p.categories.map((c) => c.category.slug);
  let total = 0;
  for (const term of terms) {
    let s = 0;
    const synonym = SCENT_SYNONYMS[term];
    if (name.startsWith(term)) s = 10;
    else if (name.split(/\s+/).some((w) => w.startsWith(term))) s = 8;
    else if (name.includes(term)) s = 6;
    else if (brand.includes(term)) s = 5;
    else if (p.noteBasis === "PUBLISHED" && notes.includes(term)) s = 4;
    else if (synonym && families.includes(synonym)) s = 3;
    else if (family.includes(term)) s = 2;
    if (s === 0) return 0;
    total += s;
  }
  return total;
}
