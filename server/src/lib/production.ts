import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

// Prisma 6's native MySQL connector uses sslcert, not sslmode/sslrootcert.
export function validateDatabaseTls(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Invalid production database configuration'); }
  const cert = url.searchParams.get('sslcert');
  if (url.protocol !== 'mysql:' || url.searchParams.getAll('sslcert').length !== 1 ||
      url.searchParams.getAll('sslaccept').length !== 1 || url.searchParams.get('sslaccept') !== 'strict' ||
      !cert || !isAbsolute(cert)) throw new Error('Production database requires an absolute CA file and strict TLS verification');
  try {
    if (!readFileSync(cert, 'utf8').includes('-----BEGIN CERTIFICATE-----')) throw new Error();
  } catch { throw new Error('Production database CA certificate is unavailable or invalid'); }
}

export function validateDemoSeed(source: NodeJS.ProcessEnv) {
  const value = source.MIGRATION_DATABASE_URL;
  if (!value) throw new Error('Missing demo bootstrap configuration');
  const url = new URL(value);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (source.NODE_ENV !== 'production' || source.ALLOW_PRODUCTION_DEMO_SEED !== 'I_ACKNOWLEDGE_EMPTY_SYNTHETIC_DEMO' ||
      !url.hostname.endsWith('.aivencloud.com') || name !== source.SEED_DATABASE_NAME ||
      !name || ['salary_management_dev', 'salary_management_m1_test_20261015'].includes(name)) {
    throw new Error('Demo bootstrap requires an acknowledged separate Aiven database');
  }
  validateDatabaseTls(value);
}
