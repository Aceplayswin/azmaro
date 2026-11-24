/**
 * Core catalogue types for AZMARO.
 *
 * Rule of thumb: anything not verified in the supplied catalogue, pricing import
 * or approved image mapping is `null` (or an empty array) – never a guess.
 */

export type ScentFamilyId =
  | "oud-woods"
  | "amber-gourmand"
  | "musk-clean"
  | "rose-floral"
  | "fresh-aromatic";

export type Gender = "men" | "women" | "unisex";

export type Concentration = "EDP" | "Extrait" | "EDT" | "Attar";

/**
 * `published` – the catalogue cites a manufacturer / database note pyramid.
 * `editorial-impression` – the catalogue only offers a scent direction; the
 * opening/heart/dry-down are impressions, NOT verified ingredients.
 */
export type NoteBasis = "published" | "editorial-impression";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "preorder";

export type ImageReviewStatus = "approved" | "pending-review" | "missing";

/** Raw profile exactly as supplied in AZMARO_Website_Perfume_Catalogue_Final.pdf */
export interface CatalogueEntry {
  slug: string;
  /** Display name (size suffix and repeated brand prefix removed). */
  name: string;
  /** Name exactly as printed in the catalogue / inventory. */
  catalogueName: string;
  brandId: string;
  /** Brand line as printed in the catalogue, e.g. "Lattafa / Asdaaf". */
  brandLabel: string;
  /** Size shown in the inventory name (e.g. "100ml"). Still to be confirmed against packaging. */
  inventorySizeMl: number | null;
  fragranceFamily: string;
  scentFamilies: ScentFamilyId[];
  noteBasis: NoteBasis;
  topNotes: string;
  heartNotes: string;
  baseNotes: string;
  scentCharacter: string;
  /** Short consumer description from the catalogue (published profiles only). */
  description: string | null;
  occasions: string;
  season: string;
  /** Audience wording from the catalogue, or null when unspecified. */
  targetAudience: string | null;
  gender: Gender | null;
  concentration: Concentration | null;
  /** Caveat wording when concentration is unconfirmed. */
  concentrationNote: string | null;
  researchBasis: string | null;
  /** Internal note for names whose spelling / variant needs confirmation. */
  reviewNote: string | null;
}

export interface ProductVariant {
  sizeMl: number;
  sku: string | null;
  price: number | null;
  mrp: number | null;
  stockStatus: StockStatus | null;
}

export interface ProductImage {
  src: string;
  alt: string;
}

export interface ImageSourceRecord {
  localPath: string | null;
  sourceUrl: string | null;
  sourcePageUrl: string | null;
  workbookStatus: string | null;
  notes: string | null;
}

/** A catalogue entry merged with pricing, inventory and approved imagery. */
export interface Product extends CatalogueEntry {
  id: string;
  brandName: string;
  variants: ProductVariant[];
  availableSizes: number[];
  /** Lowest verified variant price, or null. */
  price: number | null;
  mrp: number | null;
  sku: string | null;
  stockStatus: StockStatus | null;
  images: ProductImage[];
  imageSource: ImageSourceRecord | null;
  imageReviewStatus: ImageReviewStatus;
  isFeatured: boolean;
  isNew: boolean;
  isBestseller: boolean;
  isPublished: boolean;
  /** True only when a verified price exists and the variant is not out of stock. */
  isPurchasable: boolean;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  /** Admin-approved description. Null until supplied – never invented. */
  description: string | null;
  /** Approved brand artwork path, or null for the typographic wordmark fallback. */
  image: string | null;
  isPublished: boolean;
}

export interface BrandWithCount extends Brand {
  productCount: number;
  /** Highlighted on the homepage / directory (merchandising choice). */
  isFeatured: boolean;
}

export interface ScentFamily {
  id: ScentFamilyId;
  label: string;
  shortLabel: string;
  blurb: string;
  image: string | null;
}

export type SortKey = "featured" | "name-asc" | "name-desc" | "brand" | "price-asc" | "price-desc";

export interface CatalogueFilters {
  q?: string;
  gender?: Gender[];
  family?: ScentFamilyId[];
  concentration?: Concentration[];
  size?: number[];
  brand?: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  tag?: "new" | "bestseller" | null;
  sort?: SortKey;
}

/** Lightweight product shape returned by the API's listing endpoints. */
export type ProductSummary = Pick<
  Product,
  | "slug"
  | "name"
  | "brandId"
  | "brandName"
  | "brandLabel"
  | "scentFamilies"
  | "gender"
  | "concentration"
  | "availableSizes"
  | "variants"
  | "price"
  | "mrp"
  | "stockStatus"
  | "isPurchasable"
  | "isNew"
  | "isBestseller"
  | "isFeatured"
  | "noteBasis"
  | "topNotes"
  | "heartNotes"
  | "baseNotes"
  | "fragranceFamily"
  | "scentCharacter"
> & { image: Product["images"][number] | null; order: number };
