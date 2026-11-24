/**
 * Test launcher. On Windows, a working directory reported with a lowercase drive
 * letter (e.g. "c:\Projects") makes Node load Vitest's runner twice
 * ("c:" vs "C:" module URLs), which breaks every test. Normalising the drive
 * letter before starting Vitest avoids it; elsewhere this is a no-op.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const cwd = process.cwd().replace(/^([a-z]):/, (_m, d) => `${d.toUpperCase()}:`);
const bin = path.join(cwd, "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
