/** Environment shared by global setup and every test worker. */
export function applyTestEnv() {
  try {
    process.loadEnvFile(".env.test");
  } catch {
    /* rely on the CI environment */
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is required to run the integration tests (see API/.env.test.example).");
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith("_test")) throw new Error(`Refusing to use "${dbName}": the test database name must end with _test.`);

  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: url,
    JWT_ACCESS_SECRET: "test-access-secret-0123456789abcdef0123456789",
    JWT_REFRESH_SECRET: "test-refresh-secret-0123456789abcdef0123456789",
    BCRYPT_ROUNDS: "4",
    CORS_ORIGINS: "http://localhost:3000",
    INTEGRATION_MODE: "demo",
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER ?? "none",
    RAZORPAY_WEBHOOK_SECRET: "test_razorpay_webhook_secret",
    COURIER_WEBHOOK_SECRET: "test_courier_webhook_secret",
    RATE_LIMIT_MAX: "100000",
    RATE_LIMIT_AUTH_MAX: "100000",
    RATE_LIMIT_FORMS_MAX: "100000",
    SEED_ADMIN_EMAIL: "admin@azmaro.test",
    SEED_ADMIN_PASSWORD: "AdminPassw0rd!2026",
    SEED_ADMIN_NAME: "Test Admin",
    EMAIL_WEBHOOK_URL: "",
    CONTACT_WEBHOOK_URL: "",
    NEWSLETTER_WEBHOOK_URL: "",
  });
  return { url, dbName };
}
