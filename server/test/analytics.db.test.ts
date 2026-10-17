import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { assertEmptyDatabase } from '../prisma/seed-runner.js';
import { tokenHash } from '../src/modules/auth/routes.js';

let owner: PrismaClient;
let runtime: PrismaClient;
let app: ReturnType<typeof createApp>;
let userId: number;
let us: number, india: number, engineering: number, hr: number, engineer: number, analyst: number, specialist: number;
const employeeIds: number[] = [], departmentIds: number[] = [], designationIds: number[] = [];
const token = randomBytes(32).toString('hex');
const prefix = `M3${randomBytes(4).toString('hex')}`;
let clock = new Date('2026-10-17T23:59:59Z');
const date = (value: string) => new Date(`${value}T00:00:00Z`);
function get(path: string) { return request(app).get(`/api/v1${path}`).set('Cookie', `salary_session=${token}`); }
function report(query = '') { return get(`/analytics/compensation?reportingCurrency=USD${query}`); }
async function employee(code: string, countryId: number, designationId: number, salary?: [string, string, string], active = true, hireDate = '2020-01-01') {
  const row = await owner.employee.create({ data: { employeeCode: `${prefix}${code}`, name: `Fixture ${code}`, email: 'fixture@example.test', countryId, designationId, hireDate: date(hireDate), isActive: active } });
  employeeIds.push(row.id);
  if (salary) await owner.salaryRecord.create({ data: { employeeId: row.id, amount: salary[0], currencyCode: salary[1], effectiveDate: date(salary[2]), createdBy: userId } });
  return row.id;
}
async function isolatedGroup(code: string) {
  const department = await owner.department.create({ data: { code: `${prefix}${code}`, name: `${prefix}${code}` } });
  departmentIds.push(department.id);
  const designation = await owner.designation.create({ data: { code: `${prefix}${code}`, name: code, departmentId: department.id } });
  designationIds.push(designation.id);
  return { department: department.id, designation: designation.id };
}
beforeAll(async () => {
  const name = process.env.TEST_DATABASE_NAME;
  if (name !== 'salary_management_m1_test_20261015' || !process.env.TEST_DATABASE_URL || !process.env.TEST_RUNTIME_DATABASE_URL) throw new Error('Configure isolated test owner/runtime URLs');
  for (const value of [process.env.TEST_DATABASE_URL, process.env.TEST_RUNTIME_DATABASE_URL]) if (new URL(value).pathname !== `/${name}`) throw new Error('Test database mismatch');
  owner = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
  runtime = new PrismaClient({ datasourceUrl: process.env.TEST_RUNTIME_DATABASE_URL });
  await owner.$transaction(tx => assertEmptyDatabase(tx));
  userId = (await owner.user.create({ data: { email: `${prefix}@example.test`, passwordHash: 'not-a-login-fixture' } })).id;
  await owner.session.create({ data: { userId, tokenHash: tokenHash(token), csrfToken: randomBytes(32).toString('hex'), expiresAt: date('2030-01-01') } });
  us = (await owner.country.create({ data: { code: 'US', name: 'United States' } })).id;
  india = (await owner.country.create({ data: { code: 'IN', name: 'India' } })).id;
  await owner.currency.createMany({ data: ['USD', 'EUR', 'INR', 'JPY', 'GBP', 'CAD', 'CHF'].map(code => ({ code, name: code, isActive: code !== 'GBP' })) });
  const eng = await isolatedGroup('ENG'); engineering = eng.department; engineer = eng.designation;
  analyst = (await owner.designation.create({ data: { code: `${prefix}AN`, name: 'Analyst', departmentId: engineering } })).id; designationIds.push(analyst);
  const human = await isolatedGroup('HR'); hr = human.department; specialist = human.designation;
  await owner.exchangeRate.createMany({ data: [
    ['USD', '2024-01-01', '1'], ['EUR', '2024-01-01', '4'], ['INR', '2024-01-01', '6'],
    ['EUR', '2026-01-01', '2'], ['INR', '2026-02-01', '3'], ['GBP', '2024-01-01', '2'],
    ['EUR', '2027-01-01', '10'], ['CAD', '2024-01-01', '0.000000000001'], ['CHF', '2024-01-01', '999999999999.999999999999'],
  ].map(([currencyCode, effectiveDate, unitsPerUsd]) => ({ currencyCode: currencyCode!, effectiveDate: date(effectiveDate!), unitsPerUsd: unitsPerUsd!, source: 'Controlled test fixture' })) });
  await employee('A', us, engineer, ['0', 'USD', '2024-01-01']);
  const b = await employee('B', us, engineer, ['100', 'USD', '2026-10-17']);
  await owner.salaryRecord.createMany({ data: [
    { employeeId: b, amount: '20', currencyCode: 'USD', effectiveDate: date('2024-01-01'), createdBy: userId },
    { employeeId: b, amount: '10000', currencyCode: 'USD', effectiveDate: date('2026-10-18'), createdBy: userId },
  ] });
  await employee('C', india, analyst, ['100', 'EUR', '2024-01-01']);
  await employee('D', india, specialist, ['300', 'INR', '2024-01-01']);
  await employee('E', us, specialist, ['50', 'USD', '2024-01-01'], false);
  await employee('F', us, engineer, ['900', 'USD', '2027-01-01'], true, '2027-01-01');
  await employee('G', india, specialist);
  await employee('H', us, engineer, ['800', 'USD', '2027-01-01']);
  app = createApp({ db: runtime, origin: 'http://localhost:5173', clock: () => clock });
});
afterAll(async () => {
  if (owner && userId) await owner.$transaction(async tx => {
    await tx.session.deleteMany({ where: { userId } });
    await tx.salaryRecord.deleteMany({ where: { employeeId: { in: employeeIds }, createdBy: userId } });
    await tx.employee.deleteMany({ where: { id: { in: employeeIds } } });
    await tx.designation.deleteMany({ where: { id: { in: designationIds } } });
    await tx.department.deleteMany({ where: { id: { in: departmentIds } } });
    await tx.country.deleteMany({ where: { id: { in: [us, india].filter(Boolean) } } });
    await tx.exchangeRate.deleteMany({ where: { source: 'Controlled test fixture' } });
    await tx.currency.deleteMany({ where: { code: { in: ['USD', 'EUR', 'INR', 'JPY', 'GBP', 'CAD', 'CHF'] } } });
    await tx.user.delete({ where: { id: userId } });
  });
  await owner?.$disconnect(); await runtime?.$disconnect();
});

describe('independent controlled-dataset analytics', () => {
  it.each(['/analytics/compensation?reportingCurrency=USD', '/currencies', '/exchange-rates?reportingCurrency=USD'])('protects %s', async path => {
    expect((await request(app).get(`/api/v1${path}`)).status).toBe(401);
  });
  it('matches hand-calculated mixed-currency totals and even median without double counting', async () => {
    // Current USD equivalents: 0,100,50,100. Three active employees have no current salary.
    const response = await report('&bucketBoundaries=0,50,100');
    expect(response.status).toBe(200);
    expect(response.body.data.summary).toEqual({ employeeCount: 7, salaryCount: 4, missingSalaryCount: 3, annualBasePayTotal: '250.00', average: '62.50', median: '75.00', min: '0.00', max: '100.00' });
    expect(response.body.data.distribution.map((b: { count: number }) => b.count)).toEqual([1, 1, 2]);
    expect(response.body.data.groups).toEqual([]);
  });
  it('includes inactive employees only explicitly and computes an odd median', async () => {
    const response = await report('&includeInactive=true');
    expect(response.body.data.summary).toEqual({ employeeCount: 8, salaryCount: 5, missingSalaryCount: 3, annualBasePayTotal: '300.00', average: '60.00', median: '50.00', min: '0.00', max: '100.00' });
  });
  it.each(['country', 'department', 'designation'])('groups by %s including groups with no missing-salary substitution', async groupBy => {
    const response = await report(`&groupBy=${groupBy}`);
    expect(response.status).toBe(200);
    expect(response.body.data.summary.annualBasePayTotal).toBe('250.00');
    const groups = response.body.data.groups;
    expect(groups.map((g: { id: number }) => g.id)).toEqual([...groups.map((g: { id: number }) => g.id)].sort((a, b) => a - b));
    const totals = groups.map((g: { summary: { annualBasePayTotal: string } }) => g.summary.annualBasePayTotal);
    expect(totals).toEqual(groupBy === 'country' ? ['100.00', '150.00'] : groupBy === 'department' ? ['150.00', '100.00'] : ['100.00', '50.00', '100.00']);
  });
  it('applies AND filters, includes future hires in headcount and returns null empty statistics', async () => {
    expect((await report(`&countryId=${us}&departmentId=${engineering}&designationId=${engineer}`)).body.data.summary).toEqual({ employeeCount: 4, salaryCount: 2, missingSalaryCount: 2, annualBasePayTotal: '100.00', average: '50.00', median: '50.00', min: '0.00', max: '100.00' });
    const empty = (await report(`&departmentId=${hr}&designationId=${engineer}`)).body.data;
    expect(empty.summary).toEqual({ employeeCount: 0, salaryCount: 0, missingSalaryCount: 0, annualBasePayTotal: '0.00', average: null, median: null, min: null, max: null });
    expect(empty.distribution.every((b: { count: number }) => b.count === 0)).toBe(true);
  });
  it('uses an earlier reporting date for FX only, not salary selection', async () => {
    const result = (await report('&reportingDate=2024-01-01')).body.data;
    expect(result.salaryAsOfDate).toBe('2026-10-17');
    expect(result.summary.annualBasePayTotal).toBe('175.00'); // 0+100+25+50; B stays 100, not old 20.
    expect(result.summary.average).toBe('43.75'); expect(result.summary.median).toBe('37.50');
  });
  it('converts to EUR and reports independent rate dates/sources and identity pairs', async () => {
    const response = await get('/analytics/compensation?reportingCurrency=EUR');
    expect(response.body.data.summary.annualBasePayTotal).toBe('500.00');
    expect(response.body.data.summary.median).toBe('150.00');
    expect(response.body.data.conversion.rates.map((r: { currencyCode: string }) => r.currencyCode)).toEqual(['EUR', 'INR', 'USD']);
    expect(response.body.data.conversion.pairs).toContainEqual({ from: 'EUR', to: 'EUR', factor: '1', identity: true });
    expect(response.body.data.conversion.pairs.find((p: { from: string }) => p.from === 'INR')).toMatchObject({ sourceRateDate: '2026-02-01', targetRateDate: '2026-01-01', factor: '0.666666666666666666666666666667' });
  });
  it('allows identity conversion without FX and fails required rates without partial money', async () => {
    const identity = await report(`&countryId=${us}&reportingDate=2020-01-01`);
    expect(identity.status).toBe(200); expect(identity.body.data.conversion.rates).toEqual([]);
    const missing = await report('&reportingDate=2020-01-01');
    expect(missing.status).toBe(422); expect(missing.body.error.code).toBe('MISSING_EXCHANGE_RATES');
    expect(missing.body.data).toBeUndefined();
    expect(missing.body.error.details).toContainEqual({ field: 'affectedEmployeeCount', code: 'COUNT', message: '2' });
    expect((await get('/analytics/compensation?reportingCurrency=JPY')).status).toBe(422);
  });
  it('selects nonfuture rates, discloses unavailable currencies and includes retired catalog entries', async () => {
    const catalog = await get('/currencies');
    expect(catalog.body.data.find((c: { code: string }) => c.code === 'GBP').isActive).toBe(false);
    const result = (await get('/exchange-rates?reportingCurrency=USD')).body.data;
    expect(result.unavailableCurrencyCodes).toEqual(['JPY']);
    expect(result.rates.find((r: { currencyCode: string }) => r.currencyCode === 'EUR')).toMatchObject({ unitsPerUsd: '2.000000000000', effectiveDate: '2026-01-01', source: 'Controlled test fixture', ageDays: 289 });
    expect((await get('/exchange-rates?reportingCurrency=USD&reportingDate=2020-01-01')).body.data.rates).toEqual([]);
  });
  it.each(['reportingCurrency=ZZZ', 'reportingCurrency=GBP', 'reportingCurrency=USD&reportingDate=2026-10-18', 'reportingCurrency=USD&countryId=4294967295'])('rejects unsupported business query %s', async query => {
    expect((await get(`/analytics/compensation?${query}`)).status).toBe(422);
  });
  it.each(['', 'reportingCurrency=USD&reportingDate=2026-02-30', 'reportingCurrency=USD&includeInactive=1', 'reportingCurrency=USD&groupBy=email', 'reportingCurrency=USD&bucketBoundaries=1,2', 'reportingCurrency=USD&bucketBoundaries=0,1,1', 'reportingCurrency=USD&bucketBoundaries=0,-1', 'reportingCurrency=USD&bucketBoundaries=0,0.001', 'reportingCurrency=USD&unexpected=1'])('rejects malformed query %s', async query => {
    expect((await get(`/analytics/compensation?${query}`)).status).toBe(400);
  });
  it('captures the UTC salary date at midnight without using FX date as salary date', async () => {
    clock = new Date('2026-10-18T00:00:00Z');
    try { expect((await report('&reportingDate=2026-10-17')).body.data.summary.annualBasePayTotal).toBe('10150.00'); }
    finally { clock = new Date('2026-10-17T23:59:59Z'); }
  });
  it('rounds only after aggregation; buckets use unrounded computation values', async () => {
    const f = await isolatedGroup('ROUND');
    await employee('ROUND1', us, f.designation, ['0.01', 'EUR', '2024-01-01']);
    await employee('ROUND2', us, f.designation, ['0.01', 'EUR', '2024-01-01']);
    const result = (await report(`&departmentId=${f.department}&bucketBoundaries=0,0.01`)).body.data;
    // Each is USD .005: sum .010 -> .01, average/median .005 -> .01; both belong below .01.
    expect(result.summary).toMatchObject({ annualBasePayTotal: '0.01', average: '0.01', median: '0.01', min: '0.01', max: '0.01' });
    expect(result.distribution.map((b: { count: number }) => b.count)).toEqual([2, 0]);
  });
  it('handles repeating ratios and retired original currencies', async () => {
    const f = await isolatedGroup('REPEAT');
    await employee('REP1', india, f.designation, ['1', 'INR', '2024-01-01']);
    await employee('REP2', us, f.designation, ['1', 'GBP', '2024-01-01']);
    const result = (await report(`&departmentId=${f.department}`)).body.data;
    expect(result.summary).toMatchObject({ annualBasePayTotal: '0.83', average: '0.42', median: '0.42', min: '0.33', max: '0.50' });
  });
  it('returns groups containing only no-current employees with null statistics', async () => {
    const f = await isolatedGroup('EMPTY'); await employee('EMPTY', us, f.designation);
    const result = (await report(`&departmentId=${f.department}&groupBy=department`)).body.data;
    expect(result.summary).toMatchObject({ employeeCount: 1, salaryCount: 0, missingSalaryCount: 1, annualBasePayTotal: '0.00', median: null });
    expect(result.groups[0].summary).toEqual(result.summary);
  });
  it('preserves extreme conversion, SUM and AVG precision in real MySQL', async () => {
    const f = await isolatedGroup('EXTREME');
    for (const suffix of ['1', '2']) await employee(`EXT${suffix}`, us, f.designation, ['9999999999999.99', 'CAD', '2024-01-01']);
    const response = await get(`/analytics/compensation?reportingCurrency=CHF&departmentId=${f.department}`);
    expect(response.status).toBe(200);
    // Independent Python Decimal(precision=120) oracle, stored as literal expected strings.
    expect(response.body.data.summary).toMatchObject({
      annualBasePayTotal: '19999999999999979999999980000000000000.02',
      average: '9999999999999989999999990000000000000.01',
      median: '9999999999999989999999990000000000000.01',
      min: '9999999999999989999999990000000000000.01', max: '9999999999999989999999990000000000000.01',
    });
  });
  it('retains tiny conversion factors and rounds finite computation values consistently', async () => {
    const f = await isolatedGroup('TINY');
    await employee('TINY', us, f.designation, ['0.01', 'CHF', '2024-01-01']);
    const response = await get(`/analytics/compensation?reportingCurrency=CAD&departmentId=${f.department}`);
    expect(response.status).toBe(200);
    expect(response.body.data.summary.annualBasePayTotal).toBe('0.00');
    expect(response.body.data.conversion.pairs[0].factor).toBe('0.000000000000000000000001');
    expect(response.body.data.summary.salaryCount).toBe(1);
  });
  it('rejects an unsafe boundary without returning clipped monetary results', async () => {
    const response = await report(`&departmentId=${engineering}&bucketBoundaries=0,1${'0'.repeat(41)}`);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('REPORT_NUMERIC_RANGE_EXCEEDED');
    expect(response.body.data).toBeUndefined();
  });
  it('restores and verifies division precision on the same pooled reporting connection', async () => {
    const url = new URL(process.env.TEST_RUNTIME_DATABASE_URL!); url.searchParams.set('connection_limit', '1');
    const single = new PrismaClient({ datasourceUrl: url.href });
    try {
      await single.$executeRaw`SET SESSION div_precision_increment = 0`;
      const isolated = createApp({ db: single, origin: 'http://localhost:5173', clock: () => clock });
      const response = await request(isolated).get(`/api/v1/analytics/compensation?reportingCurrency=USD&departmentId=${engineering}`).set('Cookie', `salary_session=${token}`);
      expect(response.status).toBe(200);
      const [setting] = await single.$queryRaw<{ value: number }[]>`SELECT @@session.div_precision_increment value`;
      expect(Number(setting?.value)).toBe(4);
    } finally { await single.$disconnect(); }
  });
  it('requires missing source rates even for a zero salary', async () => {
    const f = await isolatedGroup('ZERO'); await employee('ZERO', us, f.designation, ['0', 'JPY', '2024-01-01']);
    expect((await report(`&departmentId=${f.department}`)).body.error.code).toBe('MISSING_EXCHANGE_RATES');
  });
});
