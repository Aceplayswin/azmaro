import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { corsOrigins, env } from "./config/env";
import { buildOpenApiDocument } from "./docs/registry";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { csrfProtection, originCheck, rateLimiters } from "./middleware/security";
import { legacyRouter } from "./modules/legacy/legacy.routes";
import { buildV1Router } from "./routes";

const WEBHOOK_PREFIXES = ["/api/v1/payments/webhooks/", "/api/v1/shipping/webhooks/"];

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(
    helmet({
      // Swagger UI needs inline styles/scripts on /api/docs only.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );

  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || corsOrigins.includes(origin.replace(/\/$/, ""))),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "Idempotency-Key"],
      maxAge: 600,
    }),
  );

  // JSON body with a strict size limit. The raw bytes are kept only for webhook
  // routes, whose signatures are computed over the exact body.
  app.use(
    express.json({
      limit: "100kb",
      verify: (req, _res, buf) => {
        const r = req as Request;
        if (WEBHOOK_PREFIXES.some((p) => r.originalUrl.startsWith(p))) r.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(cookieParser());

  // ── Versioned API ──
  app.use("/api/v1", rateLimiters.global(), originCheck, csrfProtection(WEBHOOK_PREFIXES), buildV1Router());
  // Routes register their documentation when their modules are imported.
  const doc = buildOpenApiDocument("/");
  app.get("/api/v1/openapi.json", (_req, res) => res.json(doc));
  // Terminate /api/v1 here so unknown v1 routes and v1 errors never fall through to the legacy router.
  app.use("/api/v1", notFoundHandler);
  app.use("/api/v1", errorHandler);
  if (env.API_DOCS_ENABLED) app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(doc, { customSiteTitle: "AZMARO API" }));

  // ── Legacy API used by the current web app ──
  if (env.LEGACY_API_ENABLED) app.use("/api", rateLimiters.global(), legacyRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
