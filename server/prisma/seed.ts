import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash, argon2id } from "argon2";
import { z } from "zod";
import { seedDatabase } from "./seed-runner.js";

const settings = z
  .object({
    NODE_ENV: z.enum(["development", "test"]).default("development"),
    MIGRATION_DATABASE_URL: z.string().url().startsWith("mysql://"),
    SEED_DATABASE_NAME: z.string().min(1),
    SEED_HR_EMAIL: z.string().trim().toLowerCase().email(),
    SEED_HR_PASSWORD: z.string().min(12).max(128),
  })
  .safeParse(process.env);
if (!settings.success) {
  console.error(
    `Seed configuration invalid: ${settings.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
  );
  process.exitCode = 1;
} else {
  const env = settings.data;
  const target = decodeURIComponent(
    new URL(env.MIGRATION_DATABASE_URL).pathname.slice(1),
  );
  if (target !== env.SEED_DATABASE_NAME) {
    console.error(
      "Seed refused: SEED_DATABASE_NAME must match the selected database.",
    );
    process.exitCode = 1;
  } else {
    const client = new PrismaClient({
      datasourceUrl: env.MIGRATION_DATABASE_URL,
    });
    try {
      const passwordHash = await hash(env.SEED_HR_PASSWORD, { type: argon2id });
      const result = await seedDatabase(
        client,
        env.SEED_HR_EMAIL,
        passwordHash,
      );
      console.info("Synthetic seed committed:", result);
    } catch {
      // Prisma error messages can include input data; keep logs free of secrets.
      console.error(
        "Seed did not report success. Check connectivity, migrations and empty-table requirement. If the connection was lost during commit, inspect row counts before retrying; the seed never overwrites existing rows.",
      );
      process.exitCode = 1;
    } finally {
      await client.$disconnect();
    }
  }
}
