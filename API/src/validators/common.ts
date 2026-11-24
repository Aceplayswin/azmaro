import { z } from "zod";

/** Shared Zod building blocks used by module validators. */

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(191)
  .email("Enter a valid email address.");

export const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use at least one letter and one number.");

/** Indian mobile: 10 digits starting 6–9, optional +91 / 0 prefix → normalised to 10 digits. */
export const indianPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a 10-digit Indian mobile number.");

export const pin = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code.");

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.")
  .max(160);

export const id = z.string().trim().min(1).max(64);

export const orderNumber = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => v.replace(/^AZM(?!-)/, "AZM-"))
  .refine((v) => /^AZM-[A-Z0-9]{4,12}$/.test(v), "Order numbers look like AZM-XXXXXXX.");

export const nonEmpty = (label: string, max = 255, min = 2) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required.`)
    .max(max, `${label} is too long.`);

export const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Positive money amount with up to 2 decimals (accepts number or numeric string). */
export const moneyAmount = z
  .union([z.number(), z.string().trim()])
  .transform((v) => String(v))
  .refine((v) => /^\d{1,8}(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Enter a positive amount with up to 2 decimals.");

export const paymentMethod = z.enum(["UPI", "CARD", "NETBANKING", "COD"]);

export const addressInput = z.object({
  label: optionalText(40),
  fullName: nonEmpty("Full name", 120),
  phone: indianPhone,
  line1: nonEmpty("Address", 255, 5),
  line2: optionalText(255),
  landmark: optionalText(120),
  city: nonEmpty("City", 80),
  state: nonEmpty("State", 80),
  pin,
});

export type AddressInput = z.infer<typeof addressInput>;

export const booleanQuery = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

export const csvList = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));
