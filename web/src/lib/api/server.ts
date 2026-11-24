import "server-only";
import type { BrandWithCount, Product, ProductSummary } from "@/types/catalogue";
import type { IntegrationStatus } from "@/types/api";

/**
 * Server-side client for the AZMARO API (used by Server Components, sitemap, etc.).
 * Browser code calls relative `/api/*` URLs instead – next.config.ts proxies those
 * to the same backend, so cookies stay first-party and no CORS is needed.
 */
export const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

/** Catalogue responses are cached briefly in production; a pricing/image import shows up within a minute. */
const REVALIDATE_SECONDS = 60;

/** In development always read live data, so admin-panel changes (prices, stock, photos) appear immediately. */
const ALWAYS_FRESH = process.env.NODE_ENV !== "production";

export class ApiUnavailableError extends Error {}

async function get<T>(path: string, opts: { allow404?: boolean; fresh?: boolean } = {}): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      headers: { Accept: "application/json" },
      ...(opts.fresh || ALWAYS_FRESH ? { cache: "no-store" as const } : { next: { revalidate: REVALIDATE_SECONDS, tags: ["catalogue"] } }),
    });
  } catch (e) {
    throw new ApiUnavailableError(`AZMARO API unreachable at ${API_URL} (${e instanceof Error ? e.message : e})`);
  }
  if (res.status === 404 && opts.allow404) return null;
  if (!res.ok) throw new ApiUnavailableError(`AZMARO API ${path} responded ${res.status}`);
  return (await res.json()) as T;
}

export async function getProductSummaries(): Promise<ProductSummary[]> {
  return (await get<{ products: ProductSummary[] }>("/products"))!.products;
}

export async function getFeaturedProducts(): Promise<ProductSummary[]> {
  return (await get<{ products: ProductSummary[] }>("/products?featured=1"))!.products;
}

export async function getProductSlugs(): Promise<string[]> {
  return (await get<{ slugs: string[] }>("/products/slugs"))!.slugs;
}

export async function getProductDetail(
  slug: string,
): Promise<{ product: Product; summary: ProductSummary; related: ProductSummary[] } | null> {
  return get(`/products/${encodeURIComponent(slug)}`, { allow404: true });
}

export async function getBrands(): Promise<BrandWithCount[]> {
  return (await get<{ brands: BrandWithCount[] }>("/brands"))!.brands;
}

/** Featured houses, in merchandising order (first = directory's featured house). */
export async function getFeaturedBrands(): Promise<BrandWithCount[]> {
  return (await get<{ brands: BrandWithCount[] }>("/brands?featured=1"))!.brands;
}

export async function getBrandDetail(slug: string): Promise<{ brand: BrandWithCount; products: ProductSummary[] } | null> {
  return get(`/brands/${encodeURIComponent(slug)}`, { allow404: true });
}

/** Which integrations are live – always fetched fresh so test-mode labels are accurate. */
export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  return (await get<IntegrationStatus>("/status", { fresh: true }))!;
}
