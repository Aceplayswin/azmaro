import { z } from "zod";
import { env } from "../../config/env";
import { db, sql, type SettingRow } from "../../db";

/**
 * Business settings stored in the `settings` table and editable by admins.
 * Every key has a Zod schema with safe defaults – nothing commercial (fees,
 * contact numbers) is invented: unknown values default to null.
 */
const nullableAmount = z.number().nonnegative().nullable();

export const settingSchemas = {
  shipping: z.object({
    /** Flat delivery charge in INR; null = "to be confirmed" (not charged). */
    flatFeeInr: nullableAmount.default(null),
    /** Free delivery at or above this subtotal; null = no threshold. */
    freeAboveInr: nullableAmount.default(null),
    /** Default parcel weight used for courier rate checks. */
    defaultWeightGrams: z.number().int().positive().default(500),
  }),
  payments: z.object({
    codEnabled: z.boolean().default(true),
    codMaxOrderInr: nullableAmount.default(null),
    onlineMethods: z.array(z.enum(["UPI", "CARD", "NETBANKING"])).default(["UPI", "CARD", "NETBANKING"]),
  }),
  orders: z.object({
    /** Customers may cancel orders only in these statuses (and before a shipment is booked). */
    cancellableStatuses: z
      .array(z.enum(["PENDING_PAYMENT", "PLACED", "CONFIRMED", "PROCESSING"]))
      .default(["PENDING_PAYMENT", "PLACED", "CONFIRMED"]),
    maxQuantityPerLine: z.number().int().min(1).max(50).default(10),
  }),
  support: z.object({
    whatsappNumber: z.string().regex(/^\d{10,15}$/).nullable().default(null),
    supportEmail: z.string().email().nullable().default(null),
    supportPhone: z.string().max(20).nullable().default(null),
    instagramUrl: z.string().url().nullable().default(null),
  }),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingSchemas)[K]>;

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const row = await db.one<SettingRow>(sql`SELECT * FROM settings WHERE \`key\` = ${key}`);
  const parsed = settingSchemas[key].safeParse(row?.value ?? {});
  return (parsed.success ? parsed.data : settingSchemas[key].parse({})) as SettingValue<K>;
}

export async function updateSetting<K extends SettingKey>(key: K, patch: unknown, actor: string): Promise<SettingValue<K>> {
  const current = await getSetting(key);
  const merged = settingSchemas[key].parse({ ...current, ...(patch as object) });
  await db.run(sql`
    INSERT INTO settings (\`key\`, value, updatedBy) VALUES (${key}, ${JSON.stringify(merged)}, ${actor}) AS incoming
    ON DUPLICATE KEY UPDATE value = incoming.value, updatedBy = incoming.updatedBy`);
  return merged as SettingValue<K>;
}

/** Defaults written by the seed (optionally from env for delivery fees). */
export const settingDefaults = () => ({
  shipping: settingSchemas.shipping.parse({
    flatFeeInr: env.DELIVERY_FLAT_FEE_INR ?? null,
    freeAboveInr: env.DELIVERY_FREE_ABOVE_INR ?? null,
  }),
  payments: settingSchemas.payments.parse({}),
  orders: settingSchemas.orders.parse({}),
  support: settingSchemas.support.parse({}),
});
