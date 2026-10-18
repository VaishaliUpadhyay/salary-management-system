import { importRoutes } from "./modules/imports/routes.js";
import express from "express";
import { masterDataRoutes } from "./modules/master-data/routes.js";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { ApiError, errorHandler } from "./lib/errors.js";
import { authModule } from "./modules/auth/routes.js";
import { analyticsRoutes } from "./modules/analytics/routes.js";
import { employeeRoutes } from "./modules/employees/routes.js";

export interface AppOptions {
  db: PrismaClient;
  origin: string;
  production?: boolean;
  clock?: () => Date;
}
export function createApp({
  db,
  origin,
  production = false,
  clock = () => new Date(),
}: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  // No trust-proxy setting: a forwarded IP cannot bypass the local login limiter.
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    req.now = new Date(clock().getTime());
    res.set({
      "X-Request-Id": req.requestId,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
    });
    if (production) res.set("Strict-Transport-Security", "max-age=31536000");
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  const auth = authModule(db, origin, production);
  app.get("/api/v1/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/v1/auth", auth.router);
  app.use(
    "/api/v1/employees",
    auth.requireSession,
    auth.mutations,
    employeeRoutes(db),
  );
  app.use(
    "/api/v1/imports",
    auth.requireSession,
    auth.mutationSecurity,
    importRoutes(db),
  );
  app.use(
    "/api/v1",
    auth.requireSession,
    masterDataRoutes(db),
    analyticsRoutes(db),
  );
  app.use(() => {
    throw new ApiError(404, "NOT_FOUND", "Route not found");
  });
  app.use(errorHandler);
  return app;
}
