import { z } from "zod";

/**
 * Lightweight OpenAPI registry. Every route is declared once with `defineRoute`
 * (see src/routes/router.ts) which both mounts the Express handler and records
 * the documentation here. `buildOpenApiDocument()` turns the registry into an
 * OpenAPI 3.0 document using Zod's native JSON-Schema export.
 */

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
export type AuthLevel = "public" | "optional" | "customer" | "admin";

export interface RouteDoc {
  method: HttpMethod;
  /** Full Express path, e.g. /api/v1/products/:slug */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  auth: AuthLevel;
  permission?: string;
  body?: z.ZodType;
  query?: z.ZodType;
  /** Mutating cookie-authenticated routes require the X-CSRF-Token header. */
  csrf?: boolean;
  successStatus?: number;
  /** Short description of `data` in the success envelope. */
  responseDescription?: string;
}

const routes: RouteDoc[] = [];

export const registerRoute = (doc: RouteDoc) => {
  routes.push(doc);
};

export const registeredRoutes = () => [...routes];

function toSchema(schema: z.ZodType) {
  try {
    const json = z.toJSONSchema(schema, { target: "openapi-3.0", io: "input", unrepresentable: "any" }) as Record<
      string,
      unknown
    >;
    delete json.$schema;
    return json;
  } catch {
    return { type: "object" };
  }
}

const envelope = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          data: { description: "Response payload" },
          meta: { type: "object", properties: { pagination: { $ref: "#/components/schemas/Pagination" } } },
        },
      },
    },
  },
});

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

export function buildOpenApiDocument(serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const r of routes) {
    const oaPath = r.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    const pathParams = [...r.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));

    const queryParams: unknown[] = [];
    if (r.query) {
      const qs = toSchema(r.query) as { properties?: Record<string, unknown>; required?: string[] };
      for (const [name, schema] of Object.entries(qs.properties ?? {})) {
        queryParams.push({ name, in: "query", required: qs.required?.includes(name) ?? false, schema });
      }
    }

    const headerParams: unknown[] = [];
    if (r.csrf) headerParams.push({ $ref: "#/components/parameters/CsrfToken" });

    const security =
      r.auth === "public"
        ? []
        : r.auth === "optional"
          ? [{}, { cookieAuth: [] }, { bearerAuth: [] }]
          : [{ cookieAuth: [] }, { bearerAuth: [] }];

    const responses: Record<string, unknown> = {
      [String(r.successStatus ?? 200)]: envelope(r.responseDescription ?? "Success"),
      "400": errorResponse("Bad request"),
      "422": errorResponse("Validation failed"),
      "429": errorResponse("Too many requests"),
      "500": errorResponse("Server error"),
    };
    if (r.auth === "customer" || r.auth === "admin") responses["401"] = errorResponse("Not signed in");
    if (r.auth === "admin" || r.csrf) responses["403"] = errorResponse("Forbidden / CSRF token missing");

    paths[oaPath] ??= {};
    paths[oaPath][r.method] = {
      tags: [r.tag],
      summary: r.summary,
      description: [r.description, r.permission ? `Requires permission \`${r.permission}\`.` : null]
        .filter(Boolean)
        .join("\n\n") || undefined,
      security,
      parameters: [...pathParams, ...queryParams, ...headerParams],
      ...(r.body
        ? { requestBody: { required: true, content: { "application/json": { schema: toSchema(r.body) } } } }
        : {}),
      responses,
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "AZMARO API",
      version: "1.0.0",
      description:
        "REST API for the AZMARO fragrance storefront. All responses use the envelope " +
        "`{ success, message, data, error?, meta? }`. Cookie-authenticated mutating requests must send " +
        "the `X-CSRF-Token` header (get it from `GET /api/v1/auth/csrf`).",
    },
    servers: [{ url: serverUrl }],
    tags: [...new Set(routes.map((r) => r.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "azm_at" },
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      parameters: {
        CsrfToken: {
          name: "X-CSRF-Token",
          in: "header",
          required: false,
          description: "Required for cookie-authenticated POST/PUT/PATCH/DELETE requests (double-submit).",
          schema: { type: "string" },
        },
      },
      schemas: {
        Pagination: {
          type: "object",
          properties: {
            page: { type: "integer" },
            pageSize: { type: "integer" },
            total: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            data: { nullable: true, example: null },
            error: {
              type: "object",
              properties: { code: { type: "string" }, details: {} },
            },
          },
        },
      },
    },
  };
}
