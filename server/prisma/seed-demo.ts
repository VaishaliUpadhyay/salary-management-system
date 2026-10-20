import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash, argon2id } from 'argon2';
import { z } from 'zod';
import { validateDemoSeed } from '../src/lib/production.js';
import { seedDatabase } from './seed-runner.js';

// Operator-only entry point. Never invoked by build/start or the normal local seed.
let db: PrismaClient | undefined;
try {
  validateDemoSeed(process.env);
  const credentials = z.object({
    SEED_HR_EMAIL: z.string().trim().toLowerCase().email(),
    SEED_HR_PASSWORD: z.string().min(12).max(128),
  }).parse(process.env);
  db = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL! });
  const passwordHash = await hash(credentials.SEED_HR_PASSWORD, { type: argon2id });
  console.info('Synthetic demo seed committed:', await seedDatabase(db, credentials.SEED_HR_EMAIL, passwordHash));
} catch {
  console.error('Demo seed refused or failed. Verify explicit remote target, acknowledgement, TLS and empty tables. Inspect counts before retrying after a lost connection; never reset.');
  process.exitCode = 1;
} finally {
  await db?.$disconnect();
}
