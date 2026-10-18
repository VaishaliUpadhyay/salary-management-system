/** Operator-only maintenance tool. Default is read-only. Never invoked by the app. */
import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, open } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildSeedData } from '../seed-data.js';

const directory = fileURLToPath(new URL('../../../.local-db-cleanup/', import.meta.url));
const manifestPath = `${directory}manifest.json`;
const database = 'salary_management_dev';
const tables = ['employees', 'salary_records', 'departments', 'designations', 'countries', 'currencies', 'exchange_rates', 'users', 'sessions'] as const;
const serialize = (value: unknown) => JSON.stringify(value, (_key, item: unknown) => typeof item === 'bigint' ? item.toString() : item);
const hash = (value: unknown) => createHash('sha256').update(serialize(value)).digest('hex');
const mode = process.argv[2] ?? 'plan';
if (!['plan', 'backup', 'apply'].includes(mode)) throw new Error('Use plan, backup, or apply');
const url = process.env[mode !== 'plan' ? 'MIGRATION_DATABASE_URL' : 'DATABASE_URL'];
if (!url) throw new Error('Required database URL missing');
const connection = new URL(url);
if (decodeURIComponent(connection.pathname.slice(1)) !== database || !['127.0.0.1', 'localhost'].includes(connection.hostname)) throw new Error('Only the local development database is allowed');
const prisma = new PrismaClient({ datasources: { db: { url } } });
const seed = buildSeedData();
const seedCodes = new Set(seed.employees.map(e => e.employeeCode));
const day = (date: Date) => date.toISOString().slice(0, 10);

async function snapshot(tx: Prisma.TransactionClient, lock = false) {
  // Full indexed scans also lock gaps under SERIALIZABLE, blocking concurrent inserts.
  if (lock) for (const table of tables) await tx.$queryRawUnsafe(`SELECT * FROM \`${table}\` FOR UPDATE`);
  const employees = await tx.employee.findMany({ orderBy: { id: 'asc' } });
  const salaries = await tx.salaryRecord.findMany({ orderBy: { id: 'asc' } });
  const preserved = employees.filter(e => seedCodes.has(e.employeeCode));
  const candidates = employees.filter(e => !seedCodes.has(e.employeeCode));
  const preservedIds = new Set(preserved.map(e => e.id));
  const salaryMap = new Map(salaries.map(s => [`${s.employeeId}:${day(s.effectiveDate)}`, s]));
  const employeeMap = new Map(employees.map(e => [e.employeeCode, e]));
  const missingCodes = seed.employees.filter(e => !employeeMap.has(e.employeeCode)).map(e => e.employeeCode);
  const baselineProblems: string[] = [];
  for (const expected of seed.salaries) {
    const code = seed.employees[expected.employeeId - 1]!.employeeCode;
    const employee = employeeMap.get(code);
    const actual = employee && salaryMap.get(`${employee.id}:${day(expected.effectiveDate)}`);
    if (!actual || !actual.amount.equals(expected.amount) || actual.currencyCode !== expected.currencyCode) baselineProblems.push(`${code}:${day(expected.effectiveDate)}`);
  }
  const masterDifferences = seed.employees.filter(expected => {
    const actual = employeeMap.get(expected.employeeCode);
    return actual && (actual.name !== expected.name || actual.email !== expected.email || actual.countryId !== expected.countryId || actual.designationId !== expected.designationId || day(actual.hireDate) !== day(expected.hireDate) || actual.isActive !== !seed.inactiveIds.includes(expected.id));
  }).map(e => e.employeeCode);
  const protectedHashes: Record<string, string> = {};
  for (const table of tables.slice(2)) {
    const rows = await tx.$queryRawUnsafe<unknown[]>(`SELECT * FROM \`${table}\``);
    protectedHashes[table] = hash(rows.map(r => serialize(r)).sort());
  }
  const preservedHash = hash({ employees: preserved, salaries: salaries.filter(s => preservedIds.has(s.employeeId)) });
  return {
    database, currentEmployees: employees.length, seededEmployees: preserved.length,
    currentSalaries: salaries.length, preservedSalaries: salaries.filter(s => preservedIds.has(s.employeeId)).length,
    proposedEmployees: candidates.length, proposedSalaries: salaries.filter(s => !preservedIds.has(s.employeeId)).length,
    missingCodes, baselineProblems, masterDifferences,
    candidates: candidates.map(e => ({ id: e.id, code: e.employeeCode })),
    groups: Object.fromEntries([...new Set(candidates.map(e => e.employeeCode.replace(/[0-9]+$/, '#')))].map(prefix => [prefix, candidates.filter(e => e.employeeCode.replace(/[0-9]+$/, '#') === prefix).length])),
    preservedHash, protectedHashes, snapshotHash: hash({ employees, salaries, protectedHashes }),
  };
}

async function backup() {
  const path = `${directory}backup-${Date.now()}.sql`;
  const file = await open(path, 'wx', 0o600);
  try {
    const exit = await new Promise<number | null>((resolve, reject) => {
      const child = spawn('docker', ['exec', '-e', 'MYSQL_PWD', 'salary-management-mysql', 'mysqldump', '--user', decodeURIComponent(connection.username), '--single-transaction', '--skip-lock-tables', '--no-tablespaces', '--set-gtid-purged=OFF', '--routines', '--events', '--triggers', database], { env: { ...process.env, MYSQL_PWD: decodeURIComponent(connection.password) }, stdio: ['ignore', file.fd, 'pipe'] });
      // Do not print database diagnostics that might contain sensitive connection details.
      child.stderr?.resume();
      child.on('error', reject); child.on('close', resolve);
    });
    if (exit !== 0) throw new Error('Backup failed; no deletion permitted');
    await file.sync();
  } finally { await file.close(); }
  const data = await readFile(path);
  if (!data.includes(Buffer.from('-- Dump completed on')) || !data.includes(Buffer.from('CREATE TABLE `employees`')) || !data.includes(Buffer.from('CREATE TABLE `salary_records`'))) throw new Error('Backup completeness checks failed');
  const receipt = { path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
  await writeFile(`${path}.receipt.json`, JSON.stringify(receipt, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('Backup verified (dump completion, required tables, checksum):', receipt);
}

try {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (mode === 'backup') {
    await backup();
  } else if (mode === 'plan') {
    const report = await prisma.$transaction(tx => snapshot(tx), { isolationLevel: 'RepeatableRead', timeout: 120_000 });
    await writeFile(manifestPath, JSON.stringify(report, null, 2), { mode: 0o600 });
    const summary = { ...report, candidates: undefined, protectedHashes: undefined };
    console.log('Approval SHA256:', hash(report));
    console.log(JSON.stringify(summary, null, 2));
    console.log(`Private allowlist: ${manifestPath}. No data changed. Approval required.`);
  } else {
    const plan = JSON.parse(await readFile(manifestPath, 'utf8')) as Awaited<ReturnType<typeof snapshot>>;
    if (process.env.CLEANUP_APPROVED_SHA256 !== hash(plan)) throw new Error('Explicit reviewed manifest approval digest required');
    if (plan.database !== database || plan.seededEmployees !== 10_000 || plan.missingCodes.length || plan.baselineProblems.length || plan.candidates.some(e => seedCodes.has(e.code))) throw new Error('Unsafe manifest');
    await prisma.$transaction(async tx => {
      const current = await snapshot(tx, true);
      if (current.proposedEmployees === 0 && current.seededEmployees === 10_000 && current.preservedHash === plan.preservedHash && hash(current.protectedHashes) === hash(plan.protectedHashes)) {
        console.log('Already cleaned; no changes.'); return;
      }
      if (hash(current) !== hash(plan)) throw new Error('Database differs from reviewed manifest; regenerate plan and obtain approval again');
      // Backup occurs while application rows/gaps are locked. Failure aborts transaction.
      await backup();
      let deletedSalaries = 0, deletedEmployees = 0;
      for (let offset = 0; offset < plan.candidates.length; offset += 500) {
        const batch = plan.candidates.slice(offset, offset + 500);
        deletedSalaries += (await tx.salaryRecord.deleteMany({ where: { employeeId: { in: batch.map(e => e.id) } } })).count;
        deletedEmployees += (await tx.employee.deleteMany({ where: { OR: batch.map(e => ({ id: e.id, employeeCode: e.code })) } })).count;
      }
      const after = await snapshot(tx);
      if (deletedEmployees !== plan.proposedEmployees || deletedSalaries !== plan.proposedSalaries || after.currentEmployees !== 10_000 || after.preservedHash !== plan.preservedHash || hash(after.protectedHashes) !== hash(plan.protectedHashes)) throw new Error('Postconditions failed; rollback');
      console.log(JSON.stringify({ deletedEmployees, deletedSalaries, remainingEmployees: after.currentEmployees, remainingSalaries: after.currentSalaries }));
    }, { isolationLevel: 'Serializable', timeout: 300_000, maxWait: 10_000 });
    console.log('Transaction committed (or already-clean no-op).');
  }
} catch (error) {
  console.error('Failure category:', error instanceof Error ? error.name : 'unknown', error instanceof Prisma.PrismaClientKnownRequestError ? error.code : '');
  console.error('Cleanup stopped safely. Check local connection, manifest approval, snapshot consistency, and backup availability. No credentials logged.');
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
