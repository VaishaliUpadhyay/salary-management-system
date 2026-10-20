import 'dotenv/config';
import { z } from 'zod';
import { validateDatabaseTls } from './production.js';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TRUST_PROXY_HOPS: z.enum(['0', '1']).default('0').transform(value => Number(value) as 0 | 1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().startsWith('mysql://'),
  APP_ORIGIN: z.string().url().refine(value => URL.canParse(value) && ['http:', 'https:'].includes(new URL(value).protocol) && new URL(value).origin === value, 'Use an exact origin without a path'),
});

export function readEnv(source: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Report field names only: never echo connection strings or secret values.
    throw new Error(`Invalid environment fields: ${[...new Set(result.error.issues.map(i => i.path.join('.')))].join(', ')}`);
  }
  if (result.data.NODE_ENV === 'production' && !result.data.APP_ORIGIN.startsWith('https://')) throw new Error('Production APP_ORIGIN must use HTTPS');
  if (result.data.NODE_ENV === 'production') validateDatabaseTls(result.data.DATABASE_URL);
  return result.data;
}
