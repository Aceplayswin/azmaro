/**
 * Pure, client-safe catalogue filtering / sorting / searching.
 * No data imports here so this can run in client components.
 */
import type { CatalogueFilters, Concentration, Gender, ScentFamilyId, SortKey } from "@/types/catalogue";
import type { ProductSummary } from "./summary";

const SCENT_SYNONYMS: Record<string, ScentFamilyId> = {
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

export function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Relevance score; 0 means "no match". Only real catalogue fields are searched. */
export function scoreProduct(p: ProductSummary, query: string): number {
  const q = normalise(query).trim();
  if (!q) return 1;
  const terms = q.split(/\s+/).filter(Boolean);
  const name = normalise(p.name);
  const brand = normalise(`${p.brandName} ${p.brandLabel}`);
  const notes = normalise(`${p.topNotes} ${p.heartNotes} ${p.baseNotes}`);
  const family = normalise(`${p.fragranceFamily} ${p.scentCharacter}`);

  let total = 0;
  for (const term of terms) {
    let s = 0;
    const synonym = SCENT_SYNONYMS[term];
    if (name.startsWith(term)) s = 10;
    else if (name.split(/\s+/).some((w) => w.startsWith(term))) s = 8;
    else if (name.includes(term)) s = 6;
    else if (brand.includes(term)) s = 5;
    else if (p.noteBasis === "published" && notes.includes(term)) s = 4;
    else if (synonym && p.scentFamilies.includes(synonym)) s = 3;
    else if (family.includes(term)) s = 2;
    if (s === 0) return 0; // every term must match something real
    total += s;
  }
  return total;
}

export function searchProducts(items: ProductSummary[], query: string, limit?: number): ProductSummary[] {
  if (!query.trim()) return [];
  const ranked = items
    .map((p) => ({ p, s: scoreProduct(p, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .map((x) => x.p);
  return typeof limit === "number" ? ranked.slice(0, limit) : ranked;
}

function sortProducts(items: ProductSummary[], sort: SortKey): ProductSummary[] {
  const list = [...items];
  const byName = (a: ProductSummary, b: ProductSummary) => a.name.localeCompare(b.name);
  switch (sort) {
    case "name-asc":
      return list.sort(byName);
    case "name-desc":
      return list.sort((a, b) => byName(b, a));
    case "brand":
      return list.sort((a, b) => a.brandName.localeCompare(b.brandName) || byName(a, b));
    case "price-asc":
    case "price-desc": {
      const dir = sort === "price-asc" ? 1 : -1;
      // unpriced items always sink to the end
      return list.sort((a, b) => {
        if (a.price === null && b.price === null) return byName(a, b);
        if (a.price === null) return 1;
        if (b.price === null) return -1;
        return (a.price - b.price) * dir;
      });
    }
    case "featured":
    default:
      return list.sort(
        (a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          Number(b.noteBasis === "published") - Number(a.noteBasis === "published") ||
          a.order - b.order,
      );
  }
}

export function applyFilters(items: ProductSummary[], f: CatalogueFilters): ProductSummary[] {
  let list = items;
  if (f.q?.trim()) list = searchProducts(list, f.q);
  if (f.gender?.length) list = list.filter((p) => p.gender !== null && f.gender!.includes(p.gender));
  if (f.family?.length) list = list.filter((p) => p.scentFamilies.some((s) => f.family!.includes(s)));
  if (f.concentration?.length)
    list = list.filter((p) => p.concentration !== null && f.concentration!.includes(p.concentration));
  if (f.size?.length) list = list.filter((p) => p.availableSizes.some((s) => f.size!.includes(s)));
  if (f.brand?.length) list = list.filter((p) => f.brand!.includes(p.brandId));
  if (f.priceMin != null) list = list.filter((p) => p.price !== null && p.price >= f.priceMin!);
  if (f.priceMax != null) list = list.filter((p) => p.price !== null && p.price <= f.priceMax!);
  if (f.tag === "new") list = list.filter((p) => p.isNew);
  if (f.tag === "bestseller") list = list.filter((p) => p.isBestseller);
  // keep relevance order for a search unless the shopper chose a sort
  if (f.q?.trim() && (!f.sort || f.sort === "featured")) return list;
  return sortProducts(list, f.sort ?? "featured");
}

export interface FacetOptions {
  genders: Gender[];
  families: ScentFamilyId[];
  concentrations: Concentration[];
  sizes: number[];
  brands: Array<{ id: string; name: string; count: number }>;
  price: { min: number; max: number } | null;
}

/** Facet values are derived from data, so filters never offer options with no products. */
export function getFacets(items: ProductSummary[]): FacetOptions {
  const genders = new Set<Gender>();
  const families = new Set<ScentFamilyId>();
  const concentrations = new Set<Concentration>();
  const sizes = new Set<number>();
  const brands = new Map<string, { id: string; name: string; count: number }>();
  const prices: number[] = [];
  for (const p of items) {
    if (p.gender) genders.add(p.gender);
    p.scentFamilies.forEach((s) => families.add(s));
    if (p.concentration) concentrations.add(p.concentration);
    p.availableSizes.forEach((s) => sizes.add(s));
    const b = brands.get(p.brandId) ?? { id: p.brandId, name: p.brandName, count: 0 };
    b.count += 1;
    brands.set(p.brandId, b);
    p.variants.forEach((v) => {
      if (v.price !== null) prices.push(v.price);
    });
  }
  const familyOrder: ScentFamilyId[] = ["oud-woods", "amber-gourmand", "musk-clean", "rose-floral", "fresh-aromatic"];
  const genderOrder: Gender[] = ["men", "women", "unisex"];
  const concOrder: Concentration[] = ["EDP", "Extrait", "EDT", "Attar"];
  return {
    genders: genderOrder.filter((g) => genders.has(g)),
    families: familyOrder.filter((f) => families.has(f)),
    concentrations: concOrder.filter((c) => concentrations.has(c)),
    sizes: [...sizes].sort((a, b) => a - b),
    brands: [...brands.values()].sort((a, b) => a.name.localeCompare(b.name)),
    price: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
  };
}

export const SORT_OPTIONS: Array<{ value: SortKey; label: string; needsPrice?: boolean }> = [
  { value: "featured", label: "Featured" },
  { value: "name-asc", label: "Name: A – Z" },
  { value: "name-desc", label: "Name: Z – A" },
  { value: "brand", label: "Brand" },
  { value: "price-asc", label: "Price: low to high", needsPrice: true },
  { value: "price-desc", label: "Price: high to low", needsPrice: true },
];

export const GENDER_LABELS: Record<Gender, string> = { men: "Men", women: "Women", unisex: "Unisex" };

export const CONCENTRATION_LABELS: Record<Concentration, string> = {
  EDP: "Eau de Parfum",
  Extrait: "Extrait de Parfum",
  EDT: "Eau de Toilette",
  Attar: "Attar",
};
