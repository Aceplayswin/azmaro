import Decimal from "decimal.js";

/**
 * Money helpers. All arithmetic uses decimal.js (arbitrary precision) and is
 * rounded half-up to 2 places – never binary floating point. Values are only
 * converted to JS numbers at the very edge, for JSON responses.
 */
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = Decimal | string | number | { toString(): string };

export const money = (v: MoneyInput | null | undefined): Decimal => new Decimal(v === null || v === undefined ? 0 : v.toString());

export const round2 = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const sum = (values: Decimal[]) => values.reduce((a, b) => a.plus(b), new Decimal(0));

export const min = (a: Decimal, b: Decimal) => (a.lessThan(b) ? a : b);

/** Serialise for JSON: number with 2 dp, or null. */
export const toAmount = (v: MoneyInput | null | undefined): number | null =>
  v === null || v === undefined ? null : round2(money(v)).toNumber();

/** Amount in paise (integer) for payment providers. */
export const toPaise = (v: MoneyInput): number => round2(money(v)).times(100).toNumber();

export { Decimal };
