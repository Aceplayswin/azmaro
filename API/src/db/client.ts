import Decimal from "decimal.js";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type TypeCastField, type TypeCastNext } from "mysql2/promise";
import { env } from "../config/env";
import { ident, join, sql, type Sql, toParam } from "./sql";

/**
 * MySQL access via mysql2. One pool per process; all SQL is written by hand
 * with `sql` templates (parameterised, never string-built from input).
 *
 * Type mapping: BOOLEAN (TINYINT(1)) → boolean, DECIMAL → Decimal (exact money),
 * DATETIME → Date (UTC), JSON → parsed value.
 */

export type Row = Record<string, unknown>;

export interface Db {
  /** All rows. */
  many<T = Row>(query: Sql): Promise<T[]>;
  /** First row or null. */
  one<T = Row>(query: Sql): Promise<T | null>;
  /** INSERT / UPDATE / DELETE – affectedRows counts matched rows. */
  run(query: Sql): Promise<{ affectedRows: number; insertId: number }>;
}

function typeCast(field: TypeCastField, next: TypeCastNext) {
  if (field.type === "TINY" && field.length === 1) {
    const v = field.string();
    return v === null ? null : v === "1";
  }
  if (field.type === "NEWDECIMAL") {
    const v = field.string();
    return v === null ? null : new Decimal(v);
  }
  return next();
}

/** Connection settings from DATABASE_URL (mysql://user:pass@host:port/db). */
export function connectionOptions(url = env.DATABASE_URL) {
  const u = new URL(url);
  const ssl = u.searchParams.get("ssl");
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1)) || undefined,
    ...(ssl === "true" || ssl === "required" ? { ssl: { rejectUnauthorized: true } } : {}),
    timezone: "Z" as const,
    charset: "utf8mb4_unicode_ci",
    typeCast,
    stringifyObjects: true,
  };
}

const globalForDb = globalThis as unknown as { __azmaroPool?: Pool };

function createPool() {
  const p = mysql.createPool({ ...connectionOptions(), connectionLimit: 10, waitForConnections: true, enableKeepAlive: true });
  // Store and compare timestamps in UTC regardless of the server's time zone.
  p.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return p;
}

export const pool: Pool = globalForDb.__azmaroPool ?? createPool();
globalForDb.__azmaroPool = pool;

function executor(conn: Pool | PoolConnection): Db {
  return {
    async many<T>(q: Sql) {
      const [rows] = await conn.query(q.text, q.values);
      return rows as T[];
    },
    async one<T>(q: Sql) {
      const [rows] = await conn.query(q.text, q.values);
      return ((rows as T[])[0] ?? null) as T | null;
    },
    async run(q: Sql) {
      const [res] = await conn.query<ResultSetHeader>(q.text, q.values);
      return { affectedRows: res.affectedRows, insertId: res.insertId };
    },
  };
}

/** Pool-backed executor for queries outside a transaction. */
export const db: Db = executor(pool);

/** Run `fn` in a transaction; commits on success, rolls back on any error. */
export async function transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(executor(conn));
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    throw e;
  } finally {
    conn.release();
  }
}

export const closeDb = () => pool.end();

// ─── Small write helpers (undefined fields are skipped, like an ORM would) ───

let counter = 0;
/** Collision-resistant, roughly time-ordered 25-char id (same shape as the existing cuid ids). */
export function newId(): string {
  counter = (counter + 1) % 1_679_616;
  const time = Date.now().toString(36).padStart(9, "0");
  const count = counter.toString(36).padStart(4, "0");
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(11)), (b) => (b % 36).toString(36)).join("");
  return `c${time}${count}${rand}`;
}

const defined = (data: Row) => Object.entries(data).filter(([, v]) => v !== undefined);

/** INSERT one row; returns the row's id (generated unless given or `id: false`). */
export async function insert(ex: Db, table: string, data: Row, opts: { id?: boolean } = {}): Promise<string> {
  const row = opts.id === false || data.id !== undefined ? data : { id: newId(), ...data };
  const entries = defined(row);
  await ex.run(sql`INSERT INTO ${ident(table)} (${join(entries.map(([k]) => ident(k)), ", ")}) VALUES (${join(entries.map(([, v]) => sql`${v}`), ", ")})`);
  return String(row.id ?? "");
}

/** INSERT many rows with the same columns. */
export async function insertMany(ex: Db, table: string, rows: Row[], opts: { id?: boolean } = {}) {
  if (!rows.length) return;
  const withIds = rows.map((r) => (opts.id === false || r.id !== undefined ? r : { id: newId(), ...r }));
  const cols = Object.keys(withIds[0]!);
  const values = withIds.map((r) => sql`(${join(cols.map((c) => sql`${toParam(r[c])}`), ", ")})`);
  await ex.run(sql`INSERT INTO ${ident(table)} (${join(cols.map(ident), ", ")}) VALUES ${join(values, ", ")}`);
}

/** `col = ?, …` for the defined fields of `data` (null clears a column). */
export function assignments(data: Row): Sql {
  return join(defined(data).map(([k, v]) => sql`${ident(k)} = ${v}`), ", ");
}

/** UPDATE rows matching `condition`; returns matched-row count. Nothing to set → just counts matches. */
export async function update(ex: Db, table: string, data: Row, condition: Sql): Promise<number> {
  const set = assignments(data);
  if (!set.text) {
    const r = await ex.one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM ${ident(table)} WHERE ${condition}`);
    return r?.n ?? 0;
  }
  const { affectedRows } = await ex.run(sql`UPDATE ${ident(table)} SET ${set} WHERE ${condition}`);
  return affectedRows;
}

/** True when MySQL itself can't be reached (server stopped, network, pool closed). */
export const isDatabaseUnavailable = (e: unknown) =>
  ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "PROTOCOL_CONNECTION_LOST", "ER_CON_COUNT_ERROR", "POOL_CLOSED"].includes(
    (e as { code?: string })?.code ?? "",
  );

/** MySQL error helpers for constraint violations. */
export const isDuplicateKey = (e: unknown) => (e as { code?: string })?.code === "ER_DUP_ENTRY";
export const isForeignKeyViolation = (e: unknown) =>
  ["ER_ROW_IS_REFERENCED_2", "ER_NO_REFERENCED_ROW_2", "ER_ROW_IS_REFERENCED", "ER_NO_REFERENCED_ROW"].includes((e as { code?: string })?.code ?? "");
