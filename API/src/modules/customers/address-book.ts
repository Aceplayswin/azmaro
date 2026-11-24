import { db, insert, sql, type Db } from "../../db";
import type { AddressInput } from "../../validators/common";

/**
 * Keep a signed-in customer's address book and phone up to date from their orders:
 *  - the delivery address is saved unless the same street + PIN is already saved
 *  - the first saved address becomes the default
 *  - the account phone is filled in when it is still empty (never overwritten)
 */
export async function rememberCustomerDetails(userId: string, address: AddressInput, ex: Db = db) {
  const existing = await ex.one<{ id: string }>(
    sql`SELECT id FROM addresses WHERE userId = ${userId} AND LOWER(TRIM(line1)) = ${address.line1.trim().toLowerCase()} AND pin = ${address.pin} LIMIT 1`,
  );
  if (!existing) {
    const { n } = (await ex.one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM addresses WHERE userId = ${userId}`))!;
    await insert(ex, "addresses", {
      userId,
      label: address.label ?? null,
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? null,
      landmark: address.landmark ?? null,
      city: address.city,
      state: address.state,
      pin: address.pin,
      isDefault: n === 0,
    });
  }
  await ex.run(sql`UPDATE users SET phone = ${address.phone} WHERE id = ${userId} AND (phone IS NULL OR phone = '')`);
}
