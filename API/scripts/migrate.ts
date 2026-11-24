/**
 * Applies db/migrations/*.sql in filename order, once each.
 *
 *   npm run db:migrate              apply pending migrations
 *   npm run db:migrate -- --status  list applied / pending only
 *
 * Applied files are recorded in `schema_migrations` (MySQL), so each runs once.
 */
import "../src/load-env";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { connectionOptions } from "../src/db/client";

const DIR = path.resolve(__dirname, "../db/migrations");
const statusOnly = process.argv.includes("--status");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const { typeCast, ...opts } = connectionOptions(url);
  void typeCast;
  const conn = await mysql.createConnection({ ...opts, multipleStatements: true });
  try {
    await conn.query("SET time_zone = '+00:00'");
    await conn.query(
      "CREATE TABLE IF NOT EXISTS `schema_migrations` (`name` VARCHAR(191) NOT NULL PRIMARY KEY, `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
    const files = readdirSync(DIR).filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f)).sort();
    const [appliedRows] = await conn.query("SELECT name FROM schema_migrations");
    const applied = new Set((appliedRows as Array<{ name: string }>).map((r) => r.name));

    const pending = files.filter((f) => !applied.has(f));
    if (statusOnly) {
      for (const f of files) console.log(`${applied.has(f) ? "applied" : "pending"}  ${f}`);
      return;
    }
    if (!pending.length) {
      console.log("Database is up to date.");
      return;
    }
    for (const file of pending) {
      process.stdout.write(`Applying ${file} … `);
      await conn.query(readFileSync(path.join(DIR, file), "utf8"));
      await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
      console.log("done");
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
