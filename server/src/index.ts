import { createApp } from "./app.js";
import { readEnv } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { verifyRuntimePermissions } from "./lib/runtime-security.js";

const env = readEnv();
try {
  await prisma.$connect();
  await verifyRuntimePermissions(prisma);
  const server = createApp({
    db: prisma,
    origin: env.APP_ORIGIN,
    production: env.NODE_ENV === "production",
  }).listen(env.PORT, "127.0.0.1", () => {
    console.info(`API listening on port ${env.PORT}`);
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () =>
      server.close(() => {
        void prisma.$disconnect();
      }),
    );
  }
} catch {
  console.error(
    "Server startup failed: verify database connectivity and restricted runtime credentials",
  );
  await prisma.$disconnect();
  process.exitCode = 1;
}
