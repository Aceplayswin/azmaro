import Decimal from "decimal.js";

/**
 * Tiny SQL builder. Every interpolated value becomes a `?` placeholder that
 * mysql2 escapes – user input is never concatenated into SQL text.
 *
 *   sql`SELECT * FROM users WHERE email = ${email}`
 *   sql`... WHERE id IN (${ids})`            arrays expand to a list (empty → NULL, matches nothing)
 *   sql`... ${cond ? sql`AND x = ${x}` : empty}`   fragments nest
 *   sql`SELECT * FROM ${ident(table)}`         identifiers via ident() only
 */
export class Sql {
  constructor(
    readonly text: string,
    readonly values: unknown[],
  ) {}
}

export const empty = new Sql("", []);

/** Raw SQL text – only ever for constants written in code, never user input. */
export const raw = (text: string) => new Sql(text, []);

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Backtick-quoted identifier (table / column). Throws on anything unusual. */
export function ident(name: string): Sql {
  const parts = name.split(".");
  if (!parts.every((p) => IDENT.test(p))) throw new Error(`Invalid SQL identifier: ${name}`);
  return raw(parts.map((p) => `\`${p}\``).join("."));
}

/** Convert app values to driver values (money as exact strings). */
export function toParam(v: unknown): unknown {
  if (v === undefined) return null;
  if (v instanceof Decimal) return v.toString();
  if (v === null || v instanceof Date || Buffer.isBuffer(v) || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(toParam);
  throw new Error("Objects cannot be SQL parameters – JSON.stringify them explicitly.");
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): Sql {
  let text = strings[0]!;
  const params: unknown[] = [];
  values.forEach((v, i) => {
    if (v instanceof Sql) {
      text += v.text;
      params.push(...v.values);
    } else if (Array.isArray(v) && v.length === 0) {
      text += "NULL";
    } else {
      text += "?";
      params.push(toParam(v));
    }
    text += strings[i + 1]!;
  });
  return new Sql(text, params);
}

/** Join fragments with a separator (e.g. " AND ", ", "). */
export function join(parts: Sql[], separator: string): Sql {
  const kept = parts.filter((p) => p.text.trim() !== "");
  return new Sql(
    kept.map((p) => p.text).join(separator),
    kept.flatMap((p) => p.values),
  );
}

/** `WHERE a AND b …`, or nothing when there are no conditions. */
export const where = (conditions: Sql[]) => {
  const all = join(conditions, " AND ");
  return all.text ? sql`WHERE ${all}` : empty;
};

/** Escape LIKE wildcards so `contains` matches literally. */
export const likeContains = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** `LIMIT … OFFSET …` from pagination. */
export const limitOffset = ({ skip, take }: { skip: number; take: number }) => sql`LIMIT ${take} OFFSET ${skip}`;
