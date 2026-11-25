// Load API/.env (if present) into process.env. Real environment variables win.
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env file – rely on the real environment */
}

// The database can be configured either as one DATABASE_URL or as separate
// DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME. DATABASE_URL wins when both are set.
{
  const { DATABASE_URL, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DATABASE_URL && DB_HOST && DB_USER && DB_NAME) {
    const auth = `${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD ?? "")}`;
    process.env.DATABASE_URL = `mysql://${auth}@${DB_HOST}:${DB_PORT || "3306"}/${encodeURIComponent(DB_NAME)}`;
  }
}
