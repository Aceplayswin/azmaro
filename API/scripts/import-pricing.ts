/**
 * Imports AZMARO-approved prices, sizes and stock from a CSV into the database.
 *
 *   npm run import:pricing                 # reads data/pricing.csv
 *   npm run import:pricing -- path/to.csv  # (export from Excel: "CSV UTF-8")
 *   npm run import:pricing -- --dry-run
 *
 * Columns (header required):
 *   slug,size_ml,price_inr,mrp_inr,sku,stock_status,stock_qty
 *   - price_inr blank  → size exists but price is not confirmed (stays NULL)
 *   - stock_status     in_stock | low_stock | out_of_stock | preorder | blank
 *   - stock_qty        integer to track stock, blank = not tracked
 * Missing size variants are created. Everything runs in one transaction.
 */
import "../src/load-env";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { closeDb, db, insert, newId, sql, transaction, type StockStatus } from "../src/db";
import { recomputeMinPrice } from "../src/modules/catalogue/products.service";
import { money } from "../src/utils/money";

/** Excel "CSV UTF-8" exports start with a byte-order mark. */
const stripBom = (t: string) => (t.charCodeAt(0) === 0xfeff ? t.slice(1) : t);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const file = path.resolve(args.find((a) => !a.startsWith("--")) ?? "data/pricing.csv");

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

interface Line {
  line: number;
  slug: string;
  sizeMl: number;
  price: string | null;
  mrp: string | null;
  sku: string | null;
  stockStatus: StockStatus | null;
  stockQty: number | null;
}

async function main() {
  if (!existsSync(file)) throw new Error(`Pricing file not found: ${file}`);
  const [header, ...data] = parseCsv(stripBom(readFileSync(file, "utf8")));
  if (!header) throw new Error("CSV is empty.");
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const idx = { slug: col("slug"), size: col("size_ml"), price: col("price_inr"), mrp: col("mrp_inr"), sku: col("sku"), stock: col("stock_status"), qty: col("stock_qty") };
  if (idx.slug < 0 || idx.size < 0 || idx.price < 0) throw new Error("CSV must include slug, size_ml and price_inr columns.");

  const STOCK = new Map<string, StockStatus>([["in_stock", "IN_STOCK"], ["low_stock", "LOW_STOCK"], ["out_of_stock", "OUT_OF_STOCK"], ["preorder", "PREORDER"]]);
  const amount = (raw: string | undefined) => {
    const v = (raw ?? "").replace(/[₹,\s]/g, "");
    if (!v) return null;
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(v) || Number(v) <= 0) throw new Error(`invalid amount "${raw}"`);
    return v;
  };

  const products = new Map((await db.many<{ id: string; slug: string }>(sql`SELECT id, slug FROM products`)).map((p) => [p.slug, p.id]));
  const problems: string[] = [];
  const lines: Line[] = [];
  data.forEach((r, i) => {
    const line = i + 2;
    try {
      const slug = r[idx.slug]?.trim() ?? "";
      if (!products.has(slug)) throw new Error(`unknown slug "${slug}"`);
      const sizeMl = Number(r[idx.size]);
      if (!Number.isInteger(sizeMl) || sizeMl <= 0) throw new Error("invalid size_ml");
      const price = amount(r[idx.price]);
      const mrp = idx.mrp >= 0 ? amount(r[idx.mrp]) : null;
      if (price && mrp && money(mrp).lessThan(price)) throw new Error("mrp_inr is lower than price_inr");
      const stockRaw = idx.stock >= 0 ? (r[idx.stock] ?? "").trim().toLowerCase() : "";
      if (stockRaw && !STOCK.has(stockRaw)) throw new Error(`invalid stock_status "${stockRaw}"`);
      const qtyRaw = idx.qty >= 0 ? (r[idx.qty] ?? "").trim() : "";
      if (qtyRaw && !/^\d+$/.test(qtyRaw)) throw new Error(`invalid stock_qty "${qtyRaw}"`);
      lines.push({
        line,
        slug,
        sizeMl,
        price,
        mrp,
        sku: idx.sku >= 0 ? r[idx.sku]?.trim() || null : null,
        stockStatus: stockRaw ? STOCK.get(stockRaw)! : null,
        stockQty: qtyRaw ? Number(qtyRaw) : null,
      });
    } catch (e) {
      problems.push(`line ${line}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  if (problems.length) {
    console.error(`Pricing import aborted – ${problems.length} problem(s):`);
    problems.forEach((p) => console.error(`  ✗ ${p}`));
    process.exitCode = 1;
    return;
  }
  if (!lines.length) {
    console.log("No pricing rows found – nothing to import.");
    return;
  }
  if (dryRun) {
    console.log(`Dry run OK: ${lines.length} row(s) for ${new Set(lines.map((l) => l.slug)).size} product(s).`);
    return;
  }

  await transaction(async (tx) => {
    const touched = new Set<string>();
    for (const l of lines) {
      const productId = products.get(l.slug)!;
      // Create the size if missing, otherwise update price / MRP (and SKU when given).
      await tx.run(sql`
        INSERT INTO product_variants (id, productId, sizeMl, price, mrp, sku) VALUES (${newId()}, ${productId}, ${l.sizeMl}, ${l.price}, ${l.mrp}, ${l.sku}) AS incoming
        ON DUPLICATE KEY UPDATE price = incoming.price, mrp = incoming.mrp, sku = COALESCE(incoming.sku, product_variants.sku)`);
      const variant = (await tx.one<{ id: string }>(sql`SELECT id FROM product_variants WHERE productId = ${productId} AND sizeMl = ${l.sizeMl}`))!;
      await tx.run(sql`
        INSERT INTO inventory (id, variantId, quantity, stockStatus) VALUES (${newId()}, ${variant.id}, ${l.stockQty}, ${l.stockStatus}) AS incoming
        ON DUPLICATE KEY UPDATE quantity = incoming.quantity, stockStatus = incoming.stockStatus`);
      touched.add(productId);
    }
    for (const id of touched) await recomputeMinPrice(id, tx);
    await insert(tx, "audit_logs", { action: "pricing.import", entity: "pricing", meta: JSON.stringify({ file: path.basename(file), rows: lines.length }) });
  });
  console.log(`✓ Imported ${lines.length} row(s) for ${new Set(lines.map((l) => l.slug)).size} product(s).`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
