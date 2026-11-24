/** Shapes returned by the AZMARO admin API (/api/v1/admin/*). */

export type NoteBasis = "PUBLISHED" | "EDITORIAL_IMPRESSION";
export type Gender = "MEN" | "WOMEN" | "UNISEX";
export type Concentration = "EDP" | "EXTRAIT" | "EDT" | "ATTAR";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "PREORDER";
export type ImageStatus = "APPROVED" | "PENDING_REVIEW" | "REJECTED";
export type CategoryType = "SCENT_FAMILY" | "COLLECTION";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  permissions: string[];
}

export interface Inventory {
  id: string;
  variantId: string;
  quantity: number | null;
  stockStatus: StockStatus | null;
  lowStockAt: number | null;
}

export interface Variant {
  id: string;
  sizeMl: number;
  sku: string | null;
  price: number | null;
  mrp: number | null;
  stockStatus: StockStatus | null;
  isPurchasable: boolean;
  unavailableReason: string | null;
  isActive: boolean;
  inventory: Inventory | null;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  status: ImageStatus;
  sourceUrl: string | null;
  notes: string | null;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  catalogueName: string;
  brand: { id: string; slug: string; name: string };
  brandLabel: string;
  fragranceFamily: string;
  noteBasis: NoteBasis;
  topNotes: string;
  heartNotes: string;
  baseNotes: string;
  scentCharacter: string;
  description: string | null;
  occasions: string;
  season: string;
  targetAudience: string | null;
  gender: Gender | null;
  concentration: Concentration | null;
  concentrationNote: string | null;
  researchBasis: string | null;
  reviewNote: string | null;
  inventorySizeMl: number | null;
  isPublished: boolean;
  isFeatured: boolean;
  featuredRank: number | null;
  isNew: boolean;
  isBestseller: boolean;
  sortOrder: number;
  minPrice: number | null;
  variants: Variant[];
  images: ProductImage[];
  categories: Array<{ slug: string; name: string; type: CategoryType }>;
  updatedAt: string;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  featuredRank: number | null;
  productCount: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  type: CategoryType;
  sortOrder: number;
  productCount: number;
}

export const STOCK_LABEL: Record<StockStatus, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  PREORDER: "Pre-order",
};
