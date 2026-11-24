/**
 * Private local MySQL for development – a separate mysqld instance that keeps its
 * data in API/mysql-data and listens on 127.0.0.1:3307. It never touches any
 * MySQL service already installed on the machine. (The folder name must not start
 * with a dot – MySQL on Windows then fails to find its undo tablespaces.)
 *
 *   npm run db:start    # first run: initialise data dir, create API/.env, start
 *   npm run db:stop
 *   npm run db:status
 *
 * Uses the installed MySQL server binaries (override with MYSQL_BIN=<bin folder>).
 */
const { spawn, spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "mysql-data");
const LOG = path.join(DATA, "mysqld.err");
const ENV = path.join(ROOT, ".env");
const PORT = 3307;
const DB = "azmaro";

function findBin() {
  const candidates = [process.env.MYSQL_BIN];
  const base = "C:\\Program Files\\MySQL";
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base).filter((d) => /^MySQL Server/i.test(d)).sort().reverse()) candidates.push(path.join(base, d, "bin"));
  }
  candidates.push("/usr/sbin", "/usr/local/mysql/bin", "/opt/homebrew/bin", "/usr/local/bin");
  const exe = process.platform === "win32" ? ".exe" : "";
  const bin = candidates.find((c) => c && fs.existsSync(path.join(c, `mysqld${exe}`)));
  if (!bin) throw new Error("MySQL server binaries not found. Set MYSQL_BIN to the folder containing mysqld.");
  return { mysqld: path.join(bin, `mysqld${exe}`), mysqladmin: path.join(bin, `mysqladmin${exe}`), mysql: path.join(bin, `mysql${exe}`) };
}

const secret = (n = 48) => randomBytes(n).toString("base64url");

function readEnvVar(name) {
  if (!fs.existsSync(ENV)) return null;
  const line = fs.readFileSync(ENV, "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^"|"$/g, "") : null;
}

/** Credentials of the local app user, taken from API/.env (created if missing). */
function ensureEnv() {
  if (fs.existsSync(ENV)) {
    const url = new URL(readEnvVar("DATABASE_URL") ?? "mysql://x");
    return { user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), created: false };
  }
  const password = secret(18);
  const url = (db) => `"mysql://azmaro_app:${password}@127.0.0.1:${PORT}/${db}"`;
  const env = fs
    .readFileSync(path.join(ROOT, ".env.example"), "utf8")
    .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url(DB)}`)
    .replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${secret()}`)
    .replace(/^JWT_REFRESH_SECRET=.*$/m, `JWT_REFRESH_SECRET=${secret()}`);
  fs.writeFileSync(ENV, env);
  fs.writeFileSync(path.join(ROOT, ".env.test"), `TEST_DATABASE_URL=${url(DB + "_test")}\n`);
  return { user: "azmaro_app", password, created: true };
}

const isUp = () =>
  new Promise((resolve) => {
    const s = net.connect(PORT, "127.0.0.1");
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
  });

async function waitFor(up, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if ((await isUp()) === up) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function start() {
  if (await isUp()) return console.log(`Local MySQL already running on 127.0.0.1:${PORT}.`);
  const bin = findBin();
  const creds = ensureEnv();
  if (creds.created) console.log("Created API/.env and API/.env.test with generated secrets.");

  const fresh = !fs.existsSync(DATA);
  if (fresh) {
    console.log(`Initialising ${path.relative(process.cwd(), DATA)} …`);
    const r = spawnSync(bin.mysqld, ["--no-defaults", "--initialize-insecure", `--datadir=${DATA}`], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`mysqld --initialize failed: ${r.stderr || r.stdout}`);
  }

  const child = spawn(
    bin.mysqld,
    ["--no-defaults", `--datadir=${DATA}`, `--port=${PORT}`, "--bind-address=127.0.0.1", "--mysqlx=OFF", `--log-error=${LOG}`],
    // No --console: a detached process on Windows has no console and mysqld would exit.
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();
  if (!(await waitFor(true))) throw new Error(`MySQL did not start – see ${LOG}`);
  if (fresh) provision(bin, creds);
  console.log(`Local MySQL running on 127.0.0.1:${PORT} (data: API/mysql-data, log: API/mysql-data/mysqld.err).`);
}

/** First start only: create the databases and app user, then lock root with a random password. */
function provision(bin, creds) {
  const q = (v) => v.replace(/'/g, "''");
  const ident = (name) => "`" + name + "`";
  const sql = [
    `CREATE DATABASE IF NOT EXISTS ${ident(DB)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`,
    ...["localhost", "127.0.0.1"].flatMap((h) => [
      `CREATE USER IF NOT EXISTS '${q(creds.user)}'@'${h}' IDENTIFIED BY '${q(creds.password)}';`,
      `GRANT ALL PRIVILEGES ON ${ident(DB)}.* TO '${q(creds.user)}'@'${h}';`,
      `GRANT ALL PRIVILEGES ON ${ident(`${DB}_test`)}.* TO '${q(creds.user)}'@'${h}';`,
      `GRANT SHUTDOWN ON *.* TO '${q(creds.user)}'@'${h}';`,
    ]),
    // root can only log in from this machine; give it a random password nobody needs.
    `ALTER USER 'root'@'localhost' IDENTIFIED BY '${q(secret(24))}';`,
  ].join(String.fromCharCode(10));
  const r = spawnSync(bin.mysql, ["-h", "127.0.0.1", "-P", String(PORT), "-u", "root"], { input: sql, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`Provisioning failed: ${r.stderr || r.stdout}`);
  console.log(`Created database ${DB} and user ${creds.user}.`);
}

async function stop() {
  if (!(await isUp())) return console.log("Local MySQL is not running.");
  const { user, password } = ensureEnv();
  const r = spawnSync(findBin().mysqladmin, ["-h", "127.0.0.1", "-P", String(PORT), "-u", user, "shutdown"], {
    encoding: "utf8",
    env: { ...process.env, MYSQL_PWD: password },
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  await waitFor(false);
  console.log("Local MySQL stopped.");
}

const cmd = process.argv[2] ?? "start";
const run = { start, stop, status: async () => console.log((await isUp()) ? `running on 127.0.0.1:${PORT}` : "stopped") }[cmd];
if (!run) {
  console.error("Usage: node scripts/local-db.cjs start|stop|status");
  process.exit(1);
}
run().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
