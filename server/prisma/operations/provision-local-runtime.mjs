// Explicit local operator command; never run automatically by migrations or startup.
// Creates fresh database accounts/roles only. Refuses to overwrite existing accounts.
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { PrismaClient } from '@prisma/client';

const envPath = new URL('../../.env', import.meta.url);
const original = readFileSync(envPath, 'utf8');
const env = parse(original);
const developmentName = 'salary_management_dev';
const testName = 'salary_management_m1_test_20261015';
const existing = new URL(env.DATABASE_URL);
if (existing.hostname !== '127.0.0.1' || existing.pathname !== `/${developmentName}`) throw new Error('Unexpected local database target');
const ownerUrl = new URL(existing);
if (existing.username === 'salary_runtime_app') throw new Error('Runtime already configured; refusing to rotate accounts automatically');
const owner = new PrismaClient({ datasourceUrl: ownerUrl.href });
function mysql(sql) {
  const result = spawnSync('docker', ['exec', '-i', 'salary-management-mysql', 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --batch --skip-column-names'], { input: sql, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Local database provisioning command failed; details suppressed to protect credentials');
  return result.stdout.trim();
}
try {
  const before = [await owner.employee.count(), await owner.salaryRecord.count()];
  const count = mysql("SELECT COUNT(*) FROM mysql.user WHERE User IN ('salary_runtime','salary_test_runtime','salary_runtime_app','salary_test_app');");
  if (count !== '0') throw new Error('An account/role already exists; inspect it rather than replacing it');
  const roleSql = readFileSync(new URL('./runtime-role.sql', import.meta.url), 'utf8');
  mysql(roleSql);
  mysql(roleSql.replaceAll('salary_runtime', 'salary_test_runtime').replaceAll(developmentName, testName));
  const developmentPassword = randomBytes(32).toString('hex');
  const testPassword = randomBytes(32).toString('hex');
  // Passwords are generated hexadecimal, not external SQL input. SQL travels on stdin,
  // never a command argument or logged output. No credential literal is committed.
  mysql(`CREATE USER 'salary_runtime_app'@'%' IDENTIFIED BY '${developmentPassword}';
    GRANT 'salary_runtime' TO 'salary_runtime_app'@'%';
    SET DEFAULT ROLE 'salary_runtime' TO 'salary_runtime_app'@'%';
    CREATE USER 'salary_test_app'@'%' IDENTIFIED BY '${testPassword}';
    GRANT 'salary_test_runtime' TO 'salary_test_app'@'%';
    SET DEFAULT ROLE 'salary_test_runtime' TO 'salary_test_app'@'%';`);
  const runtime = new URL(ownerUrl); runtime.username = 'salary_runtime_app'; runtime.password = developmentPassword;
  const testRuntime = new URL(runtime); testRuntime.pathname = `/${testName}`; testRuntime.username = 'salary_test_app'; testRuntime.password = testPassword;
  const testOwner = new URL(ownerUrl); testOwner.pathname = `/${testName}`;
  const values = { DATABASE_URL: runtime.href, MIGRATION_DATABASE_URL: ownerUrl.href, TEST_DATABASE_URL: testOwner.href, TEST_DATABASE_NAME: testName, TEST_RUNTIME_DATABASE_URL: testRuntime.href };
  let updated = original;
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    updated = pattern.test(updated) ? updated.replace(pattern, () => line) : `${updated.trimEnd()}\n${line}\n`;
  }
  chmodSync(envPath, 0o600);
  writeFileSync(envPath, updated, { mode: 0o600 });
  console.log('Created isolated development/test runtime accounts and applied the approved role grants.');
  console.log('Updated ignored server/.env (mode 0600); runtime and owner URLs are separate.');
  console.log('Development counts unchanged:', JSON.stringify(before) === JSON.stringify([await owner.employee.count(), await owner.salaryRecord.count()]));
} catch {
  console.error('Provisioning stopped; inspect local account state before retrying. No credentials are printed and no application data was reset.');
  process.exitCode = 1;
} finally { await owner.$disconnect(); }
