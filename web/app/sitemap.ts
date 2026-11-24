import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getBrands, getProductSlugs } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [brands, slugs] = await Promise.all([getBrands(), getProductSlugs()]);
  const base = siteConfig.url.replace(/\/$/, "");
  const statics = ["", "/shop", "/middle-eastern", "/brands", "/about", "/contact", "/track-order", "/privacy", "/terms"];
  return [
    ...statics.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...brands.map((b) => ({ url: `${base}/brands/${b.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...slugs.map((slug) => ({ url: `${base}/product/${slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
