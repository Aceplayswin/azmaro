import { z } from "zod";
import { db, insert, sql, transaction, update, type AddressRow, type Db } from "../../db";
import { moduleRouter } from "../../routes/router";
import { notFound } from "../../utils/errors";
import { created, ok } from "../../utils/response";
import { addressInput, id, indianPhone, nonEmpty } from "../../validators/common";
import { getUser, toUserDto } from "../auth/auth.service";

const profileSchema = z.object({
  name: nonEmpty("Full name", 120).optional(),
  phone: indianPhone.nullable().optional(),
});
const addressSchema = addressInput.extend({ isDefault: z.boolean().default(false) });
const addressPatchSchema = addressSchema.partial();

const findAddress = (ex: Db, addressId: string, userId: string) =>
  ex.one<AddressRow>(sql`SELECT * FROM addresses WHERE id = ${addressId} AND userId = ${userId}`);

const addressDto = (a: AddressRow) => ({
  id: a.id,
  label: a.label,
  fullName: a.fullName,
  phone: a.phone,
  line1: a.line1,
  line2: a.line2,
  landmark: a.landmark,
  city: a.city,
  state: a.state,
  pin: a.pin,
  isDefault: a.isDefault,
});

export const customersRoutes = moduleRouter("/customers", "Customers");

customersRoutes.get("/me", { summary: "My profile", auth: "customer" }, async (req, res) => {
  return ok(res, toUserDto((await getUser(req.auth!.userId))!));
});

customersRoutes.patch("/me", { summary: "Update my profile", auth: "customer", body: profileSchema }, async (req, res) => {
  const input = profileSchema.parse(req.body);
  await update(db, "users", input, sql`id = ${req.auth!.userId}`);
  return ok(res, toUserDto((await getUser(req.auth!.userId))!), "Profile updated.");
});

customersRoutes.get("/me/addresses", { summary: "My saved addresses", auth: "customer" }, async (req, res) => {
  const rows = await db.many<AddressRow>(sql`SELECT * FROM addresses WHERE userId = ${req.auth!.userId} ORDER BY isDefault DESC, createdAt ASC, id ASC`);
  return ok(res, rows.map(addressDto));
});

customersRoutes.post(
  "/me/addresses",
  { summary: "Add an address", auth: "customer", body: addressSchema, successStatus: 201 },
  async (req, res) => {
    const input = addressSchema.parse(req.body);
    const userId = req.auth!.userId;
    const row = await transaction(async (tx) => {
      const { n } = (await tx.one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM addresses WHERE userId = ${userId}`))!;
      const isDefault = input.isDefault || n === 0;
      if (isDefault) await update(tx, "addresses", { isDefault: false }, sql`userId = ${userId}`);
      const addressId = await insert(tx, "addresses", { ...input, label: input.label ?? null, isDefault, userId });
      return (await findAddress(tx, addressId, userId))!;
    });
    return created(res, addressDto(row), "Address saved.");
  },
);

customersRoutes.patch(
  "/me/addresses/:id",
  { summary: "Update an address", auth: "customer", body: addressPatchSchema },
  async (req, res) => {
    const input = addressPatchSchema.parse(req.body);
    const userId = req.auth!.userId;
    const addressId = id.parse(req.params.id);
    const existing = await findAddress(db, addressId, userId);
    if (!existing) throw notFound("Address");
    const row = await transaction(async (tx) => {
      if (input.isDefault) await update(tx, "addresses", { isDefault: false }, sql`userId = ${userId}`);
      await update(tx, "addresses", input, sql`id = ${addressId}`);
      return (await findAddress(tx, addressId, userId))!;
    });
    return ok(res, addressDto(row), "Address updated.");
  },
);

customersRoutes.delete("/me/addresses/:id", { summary: "Delete an address", auth: "customer" }, async (req, res) => {
  const userId = req.auth!.userId;
  const addressId = id.parse(req.params.id);
  const existing = await findAddress(db, addressId, userId);
  if (!existing) throw notFound("Address");
  await transaction(async (tx) => {
    await tx.run(sql`DELETE FROM addresses WHERE id = ${addressId}`);
    if (existing.isDefault) {
      const next = await tx.one<AddressRow>(sql`SELECT * FROM addresses WHERE userId = ${userId} ORDER BY createdAt ASC, id ASC LIMIT 1`);
      if (next) await update(tx, "addresses", { isDefault: true }, sql`id = ${next.id}`);
    }
  });
  return ok(res, null, "Address deleted.");
});
