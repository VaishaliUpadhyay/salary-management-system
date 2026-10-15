import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().startsWith('mysql://'),
  APP_ORIGIN: z.string().url(),
});

export function readEnv(source: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Report field names only: never echo connection strings or secret values.
    throw new Error(`Invalid environment fields: ${[...new Set(result.error.issues.map(i => i.path.join('.')))].join(', ')}`);
  }
  return result.data;
}
