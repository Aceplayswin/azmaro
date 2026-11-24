/**
 * Downloads image-source workbook URLs into the web app's public folder and
 * records them as ProductImage rows.
 *
 *   npm run download:images                      # download; everything stays PENDING_REVIEW
 *   npm run download:images -- --confirm-rights  # approve eligible "Matched" images
 *   npm run download:images -- --overwrite       # replace existing files
 *
 * Rules:
 *  - Only workbook status "Matched" + exact catalogue name match + agreeing brand
 *    is eligible, and only approved when you confirm commercial usage rights.
 *  - Other statuses (Review name, Variant check, Brand mismatch, …) go to
 *    images/products/review/ as PENDING_REVIEW – never shown on the site.
 *  - Failures are skipped and logged to data/image-download-log.json.
 *  - Never substitutes a different bottle or generates images.
 */
import "../src/load-env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { env } from "../src/config/env";
import { closeDb, db, insert, sql, update } from "../src/db";

interface SourceRecord {
  row: number;
  workbookName: string;
  slug: string | null;
  matchConfidence: "exact" | "close" | "none";
  brandAgrees: boolean | null;
  imageUrl: string | null;
  sourcePageUrl: string | null;
  workbookStatus: string | null;
  notes: string | null;
  suggestedFilename: string | null;
}

const args = new Set(process.argv.slice(2));
const CONFIRM_RIGHTS = args.has("--confirm-rights");
const OVERWRITE = args.has("--overwrite");
const SOURCES = "data/image-sources.json";
const PUBLIC_DIR = path.resolve(env.WEB_PUBLIC_DIR);
const PRODUCTS_DIR = path.join(PUBLIC_DIR, "images", "products");
const REVIEW_DIR = path.join(PRODUCTS_DIR, "review");
const EXT: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/avif": ".avif" };

const safeName = (r: SourceRecord, ext: string) =>
  `${(r.suggestedFilename ?? r.slug ?? `row-${r.row}`)
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || `row-${r.row}`}${ext}`;

async function download(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "AZMARO-catalogue-image-fetcher/1.0", Accept: "image/avif,image/webp,image/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const ext = EXT[type];
  if (!ext) throw new Error(`Not an image (content-type: ${type || "unknown"})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 2048) throw new Error("File too small to be a product photo");
  return { buffer, ext };
}

async function main() {
  if (!existsSync(SOURCES)) throw new Error(`${SOURCES} not found. Run \`npm run import:images\` first.`);
  const { records } = JSON.parse(readFileSync(SOURCES, "utf8")) as { records: SourceRecord[] };
  mkdirSync(REVIEW_DIR, { recursive: true });
  const products = new Map(
    (await db.many<{ id: string; slug: string; name: string; brandName: string }>(
      sql`SELECT p.id, p.slug, p.name, b.name AS brandName FROM products p JOIN brands b ON b.id = p.brandId`,
    )).map((p) => [p.slug, p]),
  );
  const log: Array<Record<string, unknown>> = [];
  let ok = 0;
  let failed = 0;
  let approved = 0;

  for (const r of records) {
    const product = r.slug ? products.get(r.slug) : undefined;
    if (!product) {
      log.push({ row: r.row, name: r.workbookName, result: "skipped", reason: "No catalogue match" });
      continue;
    }
    if (!r.imageUrl || !/^https?:\/\//i.test(r.imageUrl)) {
      log.push({ row: r.row, slug: r.slug, result: "skipped", reason: "No direct image URL" });
      continue;
    }
    const eligible = (r.workbookStatus ?? "").trim().toLowerCase() === "matched" && r.matchConfidence === "exact" && r.brandAgrees !== false;
    const publish = eligible && CONFIRM_RIGHTS;
    const hasApproved = (await db.one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM product_images WHERE productId = ${product.id} AND status = 'APPROVED'`))!.n;
    if (hasApproved && !OVERWRITE) {
      log.push({ row: r.row, slug: r.slug, result: "skipped", reason: "Product already has an approved image" });
      continue;
    }
    try {
      const { buffer, ext } = await download(r.imageUrl);
      const diskPath = path.join(eligible ? PRODUCTS_DIR : REVIEW_DIR, safeName(r, ext));
      if (!existsSync(diskPath) || OVERWRITE) writeFileSync(diskPath, buffer);
      const url = `/${path.relative(PUBLIC_DIR, diskPath).split(path.sep).join("/")}`;
      const status = publish ? "APPROVED" : "PENDING_REVIEW";
      const existing = await db.one<{ id: string }>(sql`SELECT id FROM product_images WHERE productId = ${product.id} AND url = ${url}`);
      const data = {
        url,
        alt: `${product.brandName} ${product.name} bottle`,
        status,
        sourceUrl: r.imageUrl.slice(0, 1000),
        sourcePageUrl: r.sourcePageUrl?.slice(0, 1000) ?? null,
        workbookStatus: r.workbookStatus?.slice(0, 60) ?? null,
        notes: [r.notes, !CONFIRM_RIGHTS && eligible ? "Awaiting confirmation of image usage rights" : null].filter(Boolean).join(" · ").slice(0, 500) || null,
      } as const;
      if (existing) await update(db, "product_images", data, sql`id = ${existing.id}`);
      else await insert(db, "product_images", { ...data, productId: product.id });
      ok++;
      if (publish) approved++;
      log.push({ row: r.row, slug: r.slug, result: "downloaded", file: diskPath, status });
      console.log(`  ✓ ${r.slug} → ${url} (${status})`);
    } catch (e) {
      failed++;
      log.push({ row: r.row, slug: r.slug, result: "failed", url: r.imageUrl, reason: e instanceof Error ? e.message : String(e) });
      console.log(`  ✗ ${r.slug}: ${e instanceof Error ? e.message : e}`);
    }
  }
  writeFileSync("data/image-download-log.json", `${JSON.stringify({ at: new Date().toISOString(), log }, null, 2)}\n`);
  console.log(`\nDownloaded ${ok}, failed ${failed}, approved for display ${approved}.`);
  if (!CONFIRM_RIGHTS) console.log("Nothing was published. Re-run with --confirm-rights once image usage permission is confirmed.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
