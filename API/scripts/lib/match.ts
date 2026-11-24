import { BRANDS } from "../../db/seed-data/brands";
import { CATALOGUE } from "../../db/seed-data/catalogue";
import type { CatalogueEntry } from "../../db/seed-data/types";

export const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*ml\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const BRAND_WORDS = new Set(
  [...BRANDS.map((b) => b.name), "Lattaf", "Fragrance World"].flatMap((b) => norm(b).split(" ")),
);

const core = (s: string) =>
  norm(s)
    .split(" ")
    .filter((w) => !BRAND_WORDS.has(w))
    .join(" ");

export interface MatchResult {
  entry: CatalogueEntry | null;
  confidence: "exact" | "close" | "none";
  brandAgrees: boolean | null;
}

/** Map a workbook product name (and optional brand) to the canonical catalogue entry. */
/** Official spellings noted in the catalogue that differ from the inventory spelling. */
const ALIASES: Record<string, string> = {
  pinnace: "pinaace",
  "balas rose": "balase-rose",
  "pacific aura": "pacif-aura",
};

export function matchCatalogue(name: string, brand?: string | null): MatchResult {
  const n = norm(name);
  const alias = ALIASES[core(name)];
  if (alias) {
    const entry = CATALOGUE.find((p) => p.slug === alias)!;
    return { entry, confidence: "close", brandAgrees: brand ? norm(brand).includes(norm(entry.brandLabel).split(" ")[0]!) : null };
  }
  const c = core(name);
  let entry =
    CATALOGUE.find((p) => norm(p.catalogueName) === n) ??
    CATALOGUE.find((p) => norm(p.name) === n) ??
    CATALOGUE.find((p) => core(p.catalogueName) === c && c.length > 0) ??
    null;
  let confidence: MatchResult["confidence"] = entry ? "exact" : "none";
  if (!entry && c.length > 3) {
    const candidates = CATALOGUE.filter((p) => core(p.catalogueName).includes(c) || c.includes(core(p.catalogueName)));
    if (candidates.length === 1) {
      entry = candidates[0]!;
      confidence = "close";
    }
  }
  let brandAgrees: boolean | null = null;
  if (entry && brand && brand.trim()) {
    const b = norm(brand);
    brandAgrees = norm(entry.brandLabel)
      .split(" ")
      .some((w) => w.length > 2 && b.includes(w));
  }
  return { entry, confidence, brandAgrees };
}
