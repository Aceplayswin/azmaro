/**
 * Validates the seed catalogue and (with --db) the live database state.
 *   npm run validate:data
 *   npm run validate:data -- --db
 * Exits 1 on errors – suitable for CI.
 */
import "../src/load-env";
import { existsSync } from "node:fs";
import path from "node:path";
import { BRANDS } from "../db/seed-data/brands";
import { CATALOGUE } from "../db/seed-data/catalogue";
import { merchandising } from "../db/seed-data/merchandising";
import { PRODUCT_IMAGES } from "../db/seed-data/product-images";
import { SCENT_FAMILIES } from "../db/seed-data/scent-families";

const errors: string[] = [];
const warnings: string[] = [];
const slugs = new Set<string>();
const brandIds = new Set(BRANDS.map((b) => b.id));
const families = new Set(SCENT_FAMILIES.map((f) => f.slug));

for (const p of CATALOGUE) {
  if (slugs.has(p.slug)) errors.push(`Duplicate slug: ${p.slug}`);
  slugs.add(p.slug);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) errors.push(`Invalid slug format: ${p.slug}`);
  if (!brandIds.has(p.brandId)) errors.push(`${p.slug}: unknown brand "${p.brandId}"`);
  if (!p.scentFamilies.length) errors.push(`${p.slug}: no scent family`);
  p.scentFamilies.forEach((f) => !families.has(f) && errors.push(`${p.slug}: unknown scent family "${f}"`));
  if (p.noteBasis === "published" && !p.description) warnings.push(`${p.slug}: published profile without description`);
  if (p.reviewNote) warnings.push(`${p.slug}: ${p.reviewNote}`);
}
if (CATALOGUE.length !== 94) warnings.push(`Catalogue has ${CATALOGUE.length} profiles (source PDF lists 94).`);
merchandising.featuredSlugs.forEach((s) => !slugs.has(s) && errors.push(`featuredSlugs: unknown slug "${s}"`));
merchandising.featuredBrandIds.forEach((b) => !brandIds.has(b) && errors.push(`featuredBrandIds: unknown brand "${b}"`));

const webPublic = path.resolve(process.env.WEB_PUBLIC_DIR ?? "../web/public");
const imageSlugs = new Set<string>();
for (const img of PRODUCT_IMAGES) {
  if (!slugs.has(img.slug)) errors.push(`product-images: unknown slug "${img.slug}"`);
  if (imageSlugs.has(img.slug)) errors.push(`product-images: duplicate entry for "${img.slug}"`);
  imageSlugs.add(img.slug);
  if (!existsSync(path.join(webPublic, img.url))) errors.push(`product-images: ${img.slug} file missing ${img.url}`);
}
const approvedPhotos = PRODUCT_IMAGES.filter((i) => i.status === "APPROVED").length;

async function checkDatabase() {
  // Loaded lazily so catalogue validation works without database configuration.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { closeDb, db, sql } = require("../src/db") as typeof import("../src/db");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { env } = require("../src/config/env") as typeof import("../src/config/env");
  try {
    const n = async (q: ReturnType<typeof sql>) => (await db.one<{ n: number }>(q))!.n;
    const [products, variants, priced, images] = await Promise.all([
      n(sql`SELECT COUNT(*) AS n FROM products`),
      n(sql`SELECT COUNT(*) AS n FROM product_variants`),
      n(sql`SELECT COUNT(*) AS n FROM product_variants WHERE price IS NOT NULL`),
      db.many<{ url: string; slug: string }>(sql`SELECT i.url, p.slug FROM product_images i JOIN products p ON p.id = i.productId WHERE i.status = 'APPROVED'`),
    ]);
    console.log(`Database: ${products} products, ${variants} variants, ${priced} priced, ${images.length} approved images`);
    if (products !== CATALOGUE.length) warnings.push(`Database has ${products} products; catalogue has ${CATALOGUE.length}. Run npm run db:seed.`);
    for (const img of images) {
      if (img.url.startsWith("/") && !existsSync(path.join(path.resolve(env.WEB_PUBLIC_DIR), img.url))) {
        errors.push(`${img.slug}: approved image file missing ${img.url}`);
      }
    }
    const drift = await db.many<{ slug: string }>(sql`
      SELECT p.slug FROM products p
      WHERE p.minPrice IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.productId = p.id AND v.price IS NOT NULL)`);
    drift.forEach((d: { slug: string }) => errors.push(`${d.slug}: minPrice set but no priced variant`));
  } finally {
    await closeDb();
  }
}

async function main() {
  console.log(`Catalogue: ${CATALOGUE.length} products · ${BRANDS.length} brands · ${approvedPhotos} approved photos (${PRODUCT_IMAGES.length - approvedPhotos} held for review)`);
  if (process.argv.includes("--db")) await checkDatabase();
  if (warnings.length) {
    console.log(`\nWarnings (${warnings.length}):`);
    warnings.forEach((w) => console.log(`  ! ${w}`));
  }
  if (errors.length) {
    console.error(`\nErrors (${errors.length}):`);
    errors.forEach((e) => console.error(`  ✗ ${e}`));
    process.exitCode = 1;
    return;
  }
  console.log("\n✓ Catalogue data is valid.");
}

void main();
