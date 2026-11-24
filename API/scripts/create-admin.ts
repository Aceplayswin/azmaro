/**
 * Create (or promote) an administrator account.
 *
 *   npm run admin:create -- you@example.com "A strong password" "Your Name"
 *
 * An existing account with that email is given the ADMIN role and re-activated;
 * its password is replaced only when one is given.
 */
import "../src/load-env";
import bcrypt from "bcryptjs";
import { env } from "../src/config/env";
import { closeDb, db, insert, sql, update, type RoleRow } from "../src/db";

async function main() {
  const [rawEmail, password, name] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Usage: npm run admin:create -- <email> "<password, 12+ characters>" ["Name"]');
  }
  if (password !== undefined && password.length < 12) throw new Error("Use a password of at least 12 characters.");

  const role = await db.one<RoleRow>(sql`SELECT * FROM roles WHERE name = 'ADMIN'`);
  if (!role) throw new Error("ADMIN role missing – run `npm run db:seed` first.");
  const existing = await db.one<{ id: string }>(sql`SELECT id FROM users WHERE email = ${email}`);

  if (existing) {
    await update(
      db,
      "users",
      { roleId: role.id, isActive: true, ...(password ? { passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS) } : {}) },
      sql`id = ${existing.id}`,
    );
    await db.run(sql`UPDATE users SET tokenVersion = tokenVersion + 1 WHERE id = ${existing.id}`);
    console.log(`✓ ${email} is now an administrator${password ? " (password updated)" : ""}.`);
    return;
  }
  if (!password) throw new Error("A password is required for a new account.");
  await insert(db, "users", {
    email,
    name: name?.trim() || "AZMARO Admin",
    passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS),
    roleId: role.id,
    emailVerifiedAt: new Date(),
  });
  console.log(`✓ Created administrator ${email}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
