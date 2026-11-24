/**
 * Reads AZMARO_Perfume_Image_Sources.xlsx and maps each record to a canonical
 * catalogue product. Writes data/image-sources.json for review and for the
 * download script. It does NOT download or publish anything.
 *
 *   npm run import:images                                  # ../reference/AZMARO_Perfume_Image_Sources.xlsx
 *   npm run import:images -- "D:\path\to\workbook.xlsx"
 *
 * Column headers are detected by keyword; the detected mapping is printed so you
 * can confirm it. The catalogue (94 profiles) stays canonical – the workbook's
 * 98 rows never create new products.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { CATALOGUE } from "../db/seed-data/catalogue";
import { matchCatalogue } from "./lib/match";

const file = path.resolve(process.argv[2] ?? "../reference/AZMARO_Perfume_Image_Sources.xlsx");
if (!existsSync(file)) {
  console.error(`Workbook not found: ${file}\nCopy it into AZMARO/reference/ or pass its path as an argument.`);
  process.exit(1);
}

type Field = "name" | "brand" | "imageUrl" | "sourcePage" | "google" | "style" | "status" | "notes" | "filename";

const DETECT: Array<[Field, (h: string) => boolean]> = [
  ["google", (h) => h.includes("google")],
  ["filename", (h) => h.includes("filename") || h.includes("file name")],
  ["imageUrl", (h) => (h.includes("image") && (h.includes("url") || h.includes("link"))) || h.includes("direct")],
  ["sourcePage", (h) => h.includes("source") || h.includes("page")],
  ["status", (h) => h.includes("status")],
  ["notes", (h) => h.includes("note")],
  ["style", (h) => h.includes("background") || h.includes("style")],
  ["brand", (h) => h.includes("brand")],
  ["name", (h) => h.includes("product") || h.includes("perfume") || h.includes("fragrance") || h === "name"],
];

const cellText = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("hyperlink" in v && typeof v.hyperlink === "string") return v.hyperlink;
    if ("text" in v) return String((v as { text: unknown }).text ?? "");
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    if ("result" in v) return String((v as ExcelJS.CellFormulaValue).result ?? "");
  }
  return String(v);
};

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("Workbook has no sheets.");

  // Find the header row: first row with at least 3 recognisable headers.
  let headerRow = 1;
  const mapping = new Map<Field, number>();
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const m = new Map<Field, number>();
    sheet.getRow(r).eachCell((cell, colNumber) => {
      const h = cellText(cell.value).toLowerCase().trim();
      for (const [field, test] of DETECT) {
        if (!m.has(field) && test(h)) {
          m.set(field, colNumber);
          break;
        }
      }
    });
    if (m.size >= 3 && m.has("name")) {
      headerRow = r;
      m.forEach((v, k) => mapping.set(k, v));
      break;
    }
  }
  if (!mapping.has("name")) throw new Error("Could not find a product-name column.");

  console.log("Detected columns:");
  mapping.forEach((col, field) => console.log(`  ${field.padEnd(11)} ← column ${col} "${cellText(sheet.getRow(headerRow).getCell(col).value)}"`));

  const get = (row: ExcelJS.Row, f: Field) => (mapping.has(f) ? cellText(row.getCell(mapping.get(f)!).value).trim() : "");
  const records: unknown[] = [];
  const unmatched: string[] = [];

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = get(row, "name");
    if (!name) continue;
    const brand = get(row, "brand") || null;
    const match = matchCatalogue(name, brand);
    if (!match.entry) unmatched.push(`row ${r}: ${name}`);
    records.push({
      row: r,
      workbookName: name,
      workbookBrand: brand,
      slug: match.entry?.slug ?? null,
      matchConfidence: match.confidence,
      brandAgrees: match.brandAgrees,
      imageUrl: get(row, "imageUrl") || null,
      sourcePageUrl: get(row, "sourcePage") || null,
      googleFallbackUrl: get(row, "google") || null,
      style: get(row, "style") || null,
      workbookStatus: get(row, "status") || null,
      notes: get(row, "notes") || null,
      suggestedFilename: get(row, "filename") || null,
    });
  }

  mkdirSync("data", { recursive: true });
  writeFileSync("data/image-sources.json", `${JSON.stringify({ workbook: path.basename(file), importedAt: new Date().toISOString(), records }, null, 2)}\n`);
  const matchedSlugs = new Set((records as Array<{ slug: string | null }>).map((r) => r.slug).filter(Boolean));
  console.log(`\n✓ ${records.length} workbook records → data/image-sources.json`);
  console.log(`  Mapped to ${matchedSlugs.size} catalogue products; ${unmatched.length} unmatched.`);
  unmatched.forEach((u) => console.log(`  ? ${u}`));
  // Reconciliation: workbook rows (98) vs canonical catalogue profiles (94).
  // Several rows can point at one product (alternate sources / variants) – they
  // never create new products. The report lists duplicates, gaps and unmatched rows.
  const typed = records as Array<{ row: number; slug: string | null; workbookName: string; workbookStatus: string | null }>;
  const bySlug = new Map<string, typeof typed>();
  for (const r of typed) if (r.slug) bySlug.set(r.slug, [...(bySlug.get(r.slug) ?? []), r]);
  const duplicates = [...bySlug.entries()].filter(([, rows]) => rows.length > 1).map(([slug, rows]) => ({ slug, rows: rows.map((r) => ({ row: r.row, name: r.workbookName, status: r.workbookStatus })) }));
  const withoutSource = CATALOGUE.filter((p) => !bySlug.has(p.slug)).map((p) => p.slug);
  const report = {
    workbookRows: typed.length,
    catalogueProducts: CATALOGUE.length,
    productsWithAtLeastOneRow: bySlug.size,
    duplicateRowsForSameProduct: duplicates,
    productsWithoutImageSource: withoutSource,
    unmatchedRows: unmatched,
  };
  writeFileSync("data/image-reconciliation.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(`  Reconciliation: ${duplicates.length} product(s) with multiple rows, ${withoutSource.length} product(s) without a source → data/image-reconciliation.json`);
  console.log("\nNext: review data/image-sources.json, then run `npm run download:images`.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
