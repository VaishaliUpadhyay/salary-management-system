import 'dotenv/config';
import { randomBytes, createHash } from 'node:crypto';
import { cpus, totalmem, platform, arch } from 'node:os';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { Prisma, PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { tokenHash } from '../src/modules/auth/routes.js';
import { analyticsQuery } from '../src/modules/analytics/schemas.js';
import { reportSql } from '../src/modules/analytics/repository.js';
import { day, toDate } from '../src/lib/validation.js';
import { verifyRuntimePermissions } from '../src/lib/runtime-security.js';

// Explicit opt-in. Existing workforce, salary and FX rows are read-only.
if (process.env.PERF_DATABASE_NAME !== 'salary_management_dev' || new URL(process.env.DATABASE_URL!).pathname !== '/salary_management_dev') throw new Error('Set PERF_DATABASE_NAME=salary_management_dev to acknowledge the read workload');
const db = new PrismaClient();
let sessionId: number | undefined;
let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
const requests = 1000, concurrency = 10;
async function snapshot() {
  // Hash all persisted fields for exact before/after comparison, outside measured requests.
  // This is preservation evidence only; report calculations never load employee rows into JS.
  const hash = createHash('sha256');
  for (const table of ['employees', 'salary_records', 'exchange_rates'] as const) {
    const rows = await db.$queryRawUnsafe<unknown[]>(`SELECT * FROM ${table} ORDER BY id`);
    hash.update(JSON.stringify(rows, (_, v: unknown) => typeof v === 'bigint' ? v.toString() : v));
  }
  return hash.digest('hex');
}
try {
  await verifyRuntimePermissions(db);
  const employees = await db.employee.count(), salaries = await db.salaryRecord.count();
  if (employees < 10000) throw new Error('At least 10,000 existing employees are required');
  const before = await snapshot();
  const user = await db.user.findFirstOrThrow({ select: { id: true } });
  const token = randomBytes(32).toString('hex');
  sessionId = (await db.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), csrfToken: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 3600000) } })).id;
  const app = createApp({ db, origin: 'http://localhost:5173' });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP address');
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  const sample = await db.employee.findFirstOrThrow({ where: { isActive: true }, include: { designation: true } });
  const cases = [
    ['summary-usd', '/analytics/compensation?reportingCurrency=USD'],
    ['country-eur', '/analytics/compensation?reportingCurrency=EUR&groupBy=country'],
    ['department-usd', '/analytics/compensation?reportingCurrency=USD&groupBy=department'],
    ['designation-inr', '/analytics/compensation?reportingCurrency=INR&groupBy=designation'],
    ['combined-filters', `/analytics/compensation?reportingCurrency=USD&groupBy=designation&countryId=${sample.countryId}&departmentId=${sample.designation.departmentId}&designationId=${sample.designationId}`],
    ['employee-late-page', '/employees?page=300&pageSize=25'],
    ['employee-contains', '/employees?q=employee&pageSize=25'],
  ];
  async function send(path: string) {
    const start = performance.now();
    const response = await fetch(base + path, { headers: { Cookie: `salary_session=${token}` } });
    await response.arrayBuffer();
    return { milliseconds: performance.now() - start, status: response.status };
  }
  const results = [];
  for (const [name, path] of cases) {
    const cold = await send(path!);
    for (let i = 0; i < 20; i++) await send(path!);
    let next = 0, errors = 0;
    const times: number[] = [];
    const start = performance.now();
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (next++ < requests) {
        const result = await send(path!);
        times.push(result.milliseconds);
        if (result.status !== 200) errors++;
      }
    }));
    times.sort((a, b) => a - b);
    const percentile = (p: number) => Number(times[Math.ceil(times.length * p) - 1]!.toFixed(2));
    const result = { name, path, requests: times.length, concurrency, coldMs: Number(cold.milliseconds.toFixed(2)), coldStatus: cold.status,
      p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: percentile(1), errors, elapsedSeconds: Number(((performance.now() - start) / 1000).toFixed(2)) };
    results.push(result); console.log(JSON.stringify(result));
  }
  const today = toDate(day(new Date()));
  const rates = await db.$queryRaw<{ currencyCode: string; unitsPerUsd: Prisma.Decimal }[]>`SELECT r.currency_code currencyCode,r.units_per_usd unitsPerUsd FROM exchange_rates r JOIN (SELECT currency_code, MAX(effective_date) effective_date FROM exchange_rates WHERE effective_date<=${today} GROUP BY currency_code) l ON l.currency_code=r.currency_code AND l.effective_date=r.effective_date`;
  const plan = await db.$queryRaw(Prisma.sql`EXPLAIN ANALYZE ${reportSql(analyticsQuery.parse({ reportingCurrency: 'USD', groupBy: 'department' }), today, new Map(rates.map(r => [r.currencyCode, r.unitsPerUsd])))}`);
  const [database] = await db.$queryRaw`SELECT VERSION() version, @@session.div_precision_increment divisionPrecision, @@sql_mode sqlMode` as { version: string }[];
  const unchanged = before === await snapshot();
  const evidence = { measuredAtUtc: new Date().toISOString(), node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, hostMemoryGiB: Number((totalmem() / 2 ** 30).toFixed(2)), database, employees, salaries, warmupRequests: 20, workforceSalaryRatesUnchanged: unchanged, results, plan };
  await writeFile(new URL('../../docs/milestone-3-performance.json', import.meta.url), JSON.stringify(evidence, (_, value: unknown) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n');
  console.log('Preservation check:', unchanged ? 'PASS' : 'FAIL');
  if (!unchanged || results.some(r => r.errors || r.coldStatus !== 200)) process.exitCode = 1;
} catch (error) {
  console.error('Benchmark failed (safe diagnostic):', error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error instanceof Error ? error.name : 'unknown');
  process.exitCode = 1;
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  if (sessionId) await db.session.delete({ where: { id: sessionId } }); // Only this harness-created session.
  await db.$disconnect();
}
