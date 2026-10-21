import { createApp } from "./app.js";
import { readEnv } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { verifyRuntimePermissions } from "./lib/runtime-security.js";

import { fileURLToPath } from "node:url";

try {
  const env = readEnv();
  await prisma.$connect();
  await verifyRuntimePermissions(prisma);
  const server = createApp({
    db: prisma,
    origin: env.APP_ORIGIN,
    production: env.NODE_ENV === "production",
    trustProxyHops: env.TRUST_PROXY_HOPS,
    frontendDirectory: env.NODE_ENV === "production" ? fileURLToPath(new URL("../../client/dist/", import.meta.url)) : undefined,
  }).listen(env.PORT, env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1", () => {
    console.info(`API listening on port ${env.PORT}`);
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () =>
      server.close(() => {
        void prisma.$disconnect();
      }),
    );
  }
} catch (error) {
  console.error(
    "Startup failure type:",
    error instanceof Error ? error.name : "Unknown",
  );
  console.error(
    "Startup failure code:",
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "Unknown",
  );
}
// } catch {
//   console.error(
//     "Server startup failed: verify database connectivity and restricted runtime credentials",
//   );
//   await prisma.$disconnect();
//   process.exitCode = 1;
// }
