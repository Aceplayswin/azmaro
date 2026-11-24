import { execSync } from "node:child_process";
import mysql from "mysql2/promise";
import { applyTestEnv } from "./test-env";

/**
 * Once per test run: drop + recreate the *_test database, apply migrations,
 * seed the AZMARO catalogue and a test admin. Never touches any other database.
 */
export default async function globalSetup() {
  const { url, dbName } = applyTestEnv();
  const u = new URL(url);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  });
  await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await conn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await conn.end();

  const opts = { stdio: "pipe" as const, env: process.env, cwd: process.cwd() };
  execSync("npx tsx scripts/migrate.ts", opts);
  execSync("npx tsx db/seed.ts", opts);
}
