import supertest from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { getApp, priceProduct } from "./helpers";

let api: ReturnType<typeof supertest>;

beforeAll(async () => {
  api = supertest(await getApp());
  await priceProduct("cuban-tobacco", 100, "1500.00");
  await priceProduct("faris-al-arab", 100, "2500.00");
});

describe("product catalogue", () => {
  it("lists the 94 seeded catalogue products with pagination", async () => {
    const res = await api.get("/api/v1/products?pageSize=10&page=2");
    expect(res.status).toBe(200);
    expect(res.body.meta.pagination).toMatchObject({ page: 2, pageSize: 10, total: 94, totalPages: 10 });
    expect(res.body.data).toHaveLength(10);
  });

  it("never invents prices, ratings or stock", async () => {
    const res = await api.get("/api/v1/products/khamrah-qahwa");
    const p = res.body.data.product;
    expect(p.price).toBeNull();
    expect(p.priceStatus).toBe("TO_BE_CONFIRMED");
    expect(p.variants[0]).toMatchObject({ sizeMl: 100, price: null, stockStatus: null, isPurchasable: false });
    expect(JSON.stringify(res.body)).not.toMatch(/rating|review/i);
  });

  it("labels editorial scent impressions as unverified", async () => {
    const res = await api.get("/api/v1/products/jasoor");
    expect(res.body.data.product.noteBasis).toBe("EDITORIAL_IMPRESSION");
    expect(res.body.data.product.notesLabel).toMatch(/not a verified/i);
  });

  it("searches names, brands and verified notes", async () => {
    const saffron = await api.get("/api/v1/products?q=saffron&pageSize=100");
    expect(saffron.body.data.length).toBeGreaterThan(0);
    // 'tagetes' only appears in one published note pyramid
    const tagetes = await api.get("/api/v1/products?q=tagetes");
    expect(tagetes.body.data.map((p: { slug: string }) => p.slug)).toEqual(["club-de-nuit-urban-man-elixir"]);
    const brand = await api.get("/api/v1/products?q=rasasi&pageSize=100");
    expect(brand.body.data.every((p: { brand: { slug: string } }) => p.brand.slug === "rasasi")).toBe(true);
    const none = await api.get("/api/v1/products?q=zzzznotathing");
    expect(none.body.data).toEqual([]);
    expect(none.body.meta.pagination.total).toBe(0);
  });

  it("filters by scent family, gender, concentration and brand", async () => {
    const res = await api.get("/api/v1/products?family=oud-woods&gender=unisex&pageSize=100");
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const p of res.body.data) {
      expect(p.scentFamilies).toContain("oud-woods");
      expect(p.gender).toBe("UNISEX");
    }
    const extrait = await api.get("/api/v1/products?concentration=extrait&pageSize=100");
    expect(extrait.body.data.every((p: { concentration: string }) => p.concentration === "EXTRAIT")).toBe(true);
    const bad = await api.get("/api/v1/products?gender=robot");
    expect(bad.status).toBe(422);
  });

  it("filters and sorts by confirmed price (unpriced last)", async () => {
    const priced = await api.get("/api/v1/products?minPrice=1000&maxPrice=2000");
    expect(priced.body.data.map((p: { slug: string }) => p.slug)).toContain("cuban-tobacco");
    expect(priced.body.data.map((p: { slug: string }) => p.slug)).not.toContain("faris-al-arab");
    const sorted = await api.get("/api/v1/products?sort=price-desc&pageSize=100");
    const prices: Array<number | null> = sorted.body.data.map((p: { price: number | null }) => p.price);
    const firstNull = prices.indexOf(null);
    const pricedPart = prices.slice(0, firstNull === -1 ? undefined : firstNull) as number[];
    expect(pricedPart.length).toBeGreaterThanOrEqual(2);
    expect([...pricedPart].sort((a, b) => b - a)).toEqual(pricedPart);
    expect(prices.slice(pricedPart.length).every((p) => p === null)).toBe(true);
  });

  it("returns 404 for unknown products and exposes related products", async () => {
    expect((await api.get("/api/v1/products/not-a-perfume")).status).toBe(404);
    const res = await api.get("/api/v1/products/ameer-al-oud-intense");
    expect(res.body.data.related).toHaveLength(4);
  });

  it("derives facets from live data", async () => {
    const res = await api.get("/api/v1/products/facets");
    expect(res.body.data.brands).toHaveLength(15);
    expect(res.body.data.families.map((f: { slug: string }) => f.slug)).toEqual(["oud-woods", "amber-gourmand", "musk-clean", "rose-floral", "fresh-aromatic"]);
    expect(res.body.data.price.min).toBeLessThanOrEqual(1500);
    expect(res.body.data.price.max).toBeGreaterThanOrEqual(2500);
  });

  it("lists brands, featured brands in order, and categories", async () => {
    const brands = await api.get("/api/v1/brands");
    expect(brands.body.data).toHaveLength(15);
    const featured = await api.get("/api/v1/brands?featured=true");
    expect(featured.body.data.map((b: { slug: string }) => b.slug)).toEqual(["lattafa", "armaf", "al-haramain", "rasasi", "ibrahim-al-qurashi", "maison-asrar"]);
    const lattafa = await api.get("/api/v1/brands/lattafa/products?pageSize=50");
    expect(lattafa.body.meta.pagination.total).toBe(24);
    const cats = await api.get("/api/v1/categories?type=SCENT_FAMILY");
    expect(cats.body.data).toHaveLength(5);
  });
});
