/**
 * Imports an already-downloaded product image kit (local files + its
 * image_sources.json) into the storefront.
 *
 *   npm run import:local-images -- "<images folder>" "<image_sources.json>"
 *   npm run import:local-images -- "<images folder>" "<image_sources.json>" --approve coco,alpha
 *
 * What it does:
 *  1. Maps every row to a canonical catalogue product (rows never create products;
 *     duplicate rows for the same product are skipped, the first file wins).
 *  2. Checks each file really is a JPEG / PNG / WebP / AVIF (by its signature).
 *  3. Copies it to web/public/images/products/<slug>.<ext>, or
 *     web/public/images/products/review/<slug>.<ext> when the row's identity is
 *     still in doubt (brand / variant / source / name checks).
 *  4. Regenerates db/seed-data/product-images.ts – `npm run db:seed` loads it
 *     into product_images (APPROVED = shown on the site, PENDING_REVIEW = hidden).
 *
 * `--approve slug,slug` publishes held rows once you have confirmed the bottle.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CATALOGUE } from "../db/seed-data/catalogue";
import { matchCatalogue } from "./lib/match";

interface KitRow {
  number: number;
  product_name: string;
  image_url: string;
  source_product_page: string;
  background_style: string;
  sourcing_status: string;
  notes: string;
  suggested_filename: string;
}

const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--approve");
const approveIdx = process.argv.indexOf("--approve");
const APPROVE = new Set(approveIdx > 0 ? (process.argv[approveIdx + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : []);
const [imagesDir, sourcesFile] = positional.map((p) => path.resolve(p));
if (!imagesDir || !sourcesFile || !existsSync(imagesDir) || !existsSync(sourcesFile)) {
  console.error('Usage: npm run import:local-images -- "<images folder>" "<image_sources.json>" [--approve slug,slug]');
  process.exit(1);
}

const WEB_PUBLIC = path.resolve(process.env.WEB_PUBLIC_DIR ?? "../web/public");
const PRODUCTS_DIR = path.join(WEB_PUBLIC, "images", "products");
const REVIEW_DIR = path.join(PRODUCTS_DIR, "review");
const MANIFEST = path.resolve("db/seed-data/product-images.ts");

/** Sourcing statuses where the bottle is the right product (at most the sheet's spelling differs). */
const PUBLISHABLE = new Set(["matched", "name spelling check", "name variant check"]);

const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  ".jpg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".webp": (b) => b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP",
  ".avif": (b) => b.toString("latin1", 4, 8) === "ftyp" && /avi[fs]/.test(b.toString("latin1", 8, 12)),
};
SIGNATURES[".jpeg"] = SIGNATURES[".jpg"]!;

const rows = JSON.parse(readFileSync(sourcesFile, "utf8")) as KitRow[];
const files = readdirSync(imagesDir);
const clip = (s: string | null | undefined, n: number) => (s && s.trim() && s.trim() !== "—" ? s.trim().slice(0, n) : null);

interface ManifestEntry {
  slug: string;
  url: string;
  status: "APPROVED" | "PENDING_REVIEW";
  sourceRow: number;
  sourceUrl: string | null;
  sourcePageUrl: string | null;
  workbookStatus: string | null;
  notes: string | null;
}

const manifest: ManifestEntry[] = [];
const report = { published: [] as string[], held: [] as string[], duplicates: [] as string[], noFile: [] as string[], invalid: [] as string[], unmatched: [] as string[] };

for (const row of rows) {
  const match = matchCatalogue(row.product_name.replace(/\(second listing\)/i, ""));
  const slug = match.entry?.slug;
  if (!slug) {
    report.unmatched.push(`#${row.number} ${row.product_name}`);
    continue;
  }
  const file = files.find((f) => path.parse(f).name === row.suggested_filename);
  if (!file) {
    report.noFile.push(`${slug} (#${row.number}, ${row.sourcing_status})`);
    continue;
  }
  if (manifest.some((m) => m.slug === slug)) {
    report.duplicates.push(`#${row.number} ${row.product_name} → ${slug}`);
    continue;
  }
  const ext = path.extname(file).toLowerCase();
  const buffer = readFileSync(path.join(imagesDir, file));
  if (!SIGNATURES[ext]?.(buffer) || buffer.length < 2048) {
    report.invalid.push(`${file} (not a valid ${ext} image)`);
    continue;
  }
  const status = PUBLISHABLE.has(row.sourcing_status.trim().toLowerCase()) || APPROVE.has(slug) ? "APPROVED" : "PENDING_REVIEW";
  const targetDir = status === "APPROVED" ? PRODUCTS_DIR : REVIEW_DIR;
  mkdirSync(targetDir, { recursive: true });
  const target = path.join(targetDir, `${slug}${ext === ".jpeg" ? ".jpg" : ext}`);
  copyFileSync(path.join(imagesDir, file), target);
  // A product moved between review/ and the live folder: remove the stale copy.
  const other = path.join(status === "APPROVED" ? REVIEW_DIR : PRODUCTS_DIR, path.basename(target));
  if (existsSync(other)) rmSync(other);

  manifest.push({
    slug,
    url: `/${path.relative(WEB_PUBLIC, target).split(path.sep).join("/")}`,
    status,
    sourceRow: row.number,
    sourceUrl: clip(row.image_url, 1000),
    sourcePageUrl: clip(row.source_product_page, 1000),
    workbookStatus: clip(row.sourcing_status, 60),
    notes: clip(row.notes, 500),
  });
  (status === "APPROVED" ? report.published : report.held).push(`${slug} (${row.sourcing_status})`);
}

const covered = new Set(manifest.map((m) => m.slug));
const withoutImage = CATALOGUE.filter((p) => !covered.has(p.slug)).map((p) => p.slug);

writeFileSync(
  MANIFEST,
  `/**
 * Product photography mapped to catalogue products.
 * GENERATED by scripts/import-local-images.ts – re-run the script instead of editing by hand.
 *
 * APPROVED       – the bottle matches the catalogue product; shown on the storefront.
 * PENDING_REVIEW – identity still to be confirmed (brand / variant / source / name); hidden
 *                  until approved (re-run with --approve <slug> or PATCH /api/v1/admin/images/:id).
 * Source URLs record provenance only – they are not proof of usage rights.
 *
 * Products without a photo (${withoutImage.length}): ${withoutImage.join(", ") || "none"}
 */
export interface ProductImageSeed {
  slug: string;
  url: string;
  status: "APPROVED" | "PENDING_REVIEW";
  sourceRow: number;
  sourceUrl: string | null;
  sourcePageUrl: string | null;
  workbookStatus: string | null;
  notes: string | null;
}

export const PRODUCT_IMAGES: ProductImageSeed[] = ${JSON.stringify(manifest, null, 2)};
`,
);

const section = (title: string, list: string[]) => {
  console.log(`\n${title}: ${list.length}`);
  list.forEach((l) => console.log(`  ${l}`));
};
console.log(`${rows.length} kit rows, ${files.length} files → ${manifest.length} products with a photo`);
section("Published", report.published);
section("Held for review (hidden)", report.held);
section("Duplicate rows skipped", report.duplicates);
section("Rows without a file", report.noFile);
section("Invalid files", report.invalid);
section("Unmatched rows", report.unmatched);
console.log(`\nManifest written to ${path.relative(process.cwd(), MANIFEST)}. Run \`npm run db:seed\` to load it.`);
