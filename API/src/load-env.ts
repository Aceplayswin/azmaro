// Load API/.env (if present) into process.env. Real environment variables win.
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env file – rely on the real environment */
}
