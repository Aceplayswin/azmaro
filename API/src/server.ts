import "./load-env"; // must be first: loads API/.env before config is read
import { env } from "./config/env";
import { createApp } from "./app";
import { paymentIntegrationStatus } from "./integrations/payments";
import { shippingIntegrationStatus } from "./integrations/shipping";
import { closeDb, db, sql } from "./db";

async function main() {
  await db.one(sql`SELECT 1`); // fail fast if the database is unreachable
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`AZMARO API listening on http://localhost:${env.PORT}`);
    console.log(`  v1:      http://localhost:${env.PORT}/api/v1  ·  docs: http://localhost:${env.PORT}/api/docs`);
    console.log(`  mode:    ${env.INTEGRATION_MODE}  ·  payments: ${paymentIntegrationStatus().provider}  ·  shipping: ${shippingIntegrationStatus().provider}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received – shutting down`);
    server.close(() => {
      void closeDb().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error("Failed to start AZMARO API:", e instanceof Error ? e.message : e);
  process.exit(1);
});
