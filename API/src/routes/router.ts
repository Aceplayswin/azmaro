import { Router, type RequestHandler } from "express";
import type { z } from "zod";
import { authenticate, requireAuth, requirePermission } from "../middleware/auth";
import { registerRoute, type AuthLevel, type HttpMethod } from "../docs/registry";

interface RouteOptions {
  summary: string;
  description?: string;
  auth?: AuthLevel;
  permission?: string;
  body?: z.ZodType;
  query?: z.ZodType;
  successStatus?: number;
  response?: string;
  middleware?: RequestHandler[];
}

/**
 * Module router: mounts handlers AND records OpenAPI documentation from the
 * same definition, so docs can't drift from the code.
 */
export function moduleRouter(basePath: string, tag: string, prefix = "/api/v1") {
  const router = Router();

  const define =
    (method: HttpMethod) =>
    (path: string, options: RouteOptions, handler: RequestHandler) => {
      const auth = options.auth ?? "public";
      registerRoute({
        method,
        path: `${prefix}${basePath}${path === "/" ? "" : path}`,
        tag,
        summary: options.summary,
        description: options.description,
        auth,
        permission: options.permission,
        body: options.body,
        query: options.query,
        csrf: method !== "get",
        successStatus: options.successStatus,
        responseDescription: options.response,
      });
      const guards: RequestHandler[] = [];
      if (auth === "customer") guards.push(requireAuth);
      if (auth === "admin") guards.push(requirePermission(options.permission));
      router[method](path, ...(options.middleware ?? []), ...guards, handler);
    };

  router.use(authenticate);

  return {
    router,
    basePath,
    get: define("get"),
    post: define("post"),
    put: define("put"),
    patch: define("patch"),
    delete: define("delete"),
  };
}
