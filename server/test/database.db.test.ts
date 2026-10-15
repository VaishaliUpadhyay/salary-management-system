import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertEmptyDatabase, populateSeed } from '../prisma/seed-runner.js';

const url = process.env.TEST_DATABASE_URL;
const acknowledgedName = process.env.TEST_DATABASE_NAME;
let client: PrismaClient;
const rollback = new Error('TEST_TRANSACTION_ROLLBACK');

beforeAll(async () => {
  if (!url || !acknowledgedName) throw new Error('Live database checks require TEST_DATABASE_URL and TEST_DATABASE_NAME for an empty, migrated, dedicated test database.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'mysql:' || decodeURIComponent(parsed.pathname.slice(1)) !== acknowledgedName || process.env.NODE_ENV === 'production') {
    throw new Error('Test database target was not explicitly acknowledged.');
  }
  client = new PrismaClient({ datasourceUrl: url });
  await client.$connect();
  const [version] = await client.$queryRaw<{ version: string }[]>`SELECT VERSION() AS version`;
  expect(version?.version).toMatch(/^8\./);
  if (version?.version.startsWith('8.0.')) expect(Number(version.version.split('.')[2]?.split('-')[0])).toBeGreaterThanOrEqual(16);
  await client.$transaction(tx => assertEmptyDatabase(tx));
});
afterAll(async () => { if (client) await client.$disconnect(); });

async function rolledBack(work: (tx: Prisma.TransactionClient) => Promise<void>) {
  try {
    await client.$transaction(async tx => { await work(tx); throw rollback; }, { timeout: 120000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function fixture(tx: Prisma.TransactionClient) {
  const suffix = randomUUID().slice(0, 8);
  const department = await tx.department.create({ data: { code: `T${suffix}`, name: `Test ${suffix}` } });
  const designation = await tx.designation.create({ data: { code: `D${suffix}`, name: 'Analyst', departmentId: department.id } });
  const country = await tx.country.create({ data: { code: 'US', name: 'United States' } });
  await tx.currency.createMany({ data: [{ code: 'USD', name: 'US Dollar' }, { code: 'EUR', name: 'Euro' }] });
  const user = await tx.user.create({ data: { email: `${suffix}@example.test`, passwordHash: 'not-a-login-fixture' } });
  const employee = await tx.employee.create({ data: { employeeCode: `EMP${suffix}`, name: 'Synthetic Employee', email: 'shared@example.test', designationId: designation.id, countryId: country.id, hireDate: new Date('2020-01-01T00:00:00Z') } });
  const salary = { employeeId: employee.id, amount: '100.00', currencyCode: 'USD', effectiveDate: new Date('2024-02-29T00:00:00Z'), createdBy: user.id };
  await tx.salaryRecord.create({ data: salary });
  return { department, designation, country, user, employee, salary };
}

describe('initial MySQL migration constraints (all fixtures rolled back)', () => {
  it('enforces employee/date uniqueness and department-scoped designation uniqueness', async () => rolledBack(async tx => {
    const f = await fixture(tx);
    await expect(tx.salaryRecord.create({ data: f.salary })).rejects.toMatchObject({ code: 'P2002' });
    await expect(tx.designation.create({ data: { code: 'OTHER', name: 'analyst', departmentId: f.department.id } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(tx.employee.create({ data: { employeeCode: f.employee.employeeCode, name: 'Duplicate', email: 'other@example.test', hireDate: f.employee.hireDate, designationId: f.designation.id, countryId: f.country.id } })).rejects.toMatchObject({ code: 'P2002' });
  }));

  it('enforces foreign keys and restricts deletion of referenced rows', async () => rolledBack(async tx => {
    const f = await fixture(tx);
    await expect(tx.department.delete({ where: { id: f.department.id } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(tx.employee.delete({ where: { id: f.employee.id } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(tx.salaryRecord.create({ data: { ...f.salary, effectiveDate: new Date('2025-01-01'), currencyCode: 'ZZZ' } })).rejects.toMatchObject({ code: 'P2003' });
  }));

  it('enforces salary/rate CHECK constraints, including USD = 1', async () => rolledBack(async tx => {
    const f = await fixture(tx);
    await expect(tx.$executeRaw`INSERT INTO salary_records (employee_id,amount,currency_code,effective_date,created_by) VALUES (${f.employee.id},-0.01,'USD','2025-01-01',${f.user.id})`).rejects.toMatchObject({ code: 'P2010', meta: { code: '3819' } });
    for (const rate of ['0', '-1']) {
      await expect(tx.$executeRaw`INSERT INTO exchange_rates (currency_code,effective_date,units_per_usd,source) VALUES ('EUR','2026-01-01',${rate},'test')`).rejects.toMatchObject({ code: 'P2010', meta: { code: '3819' } });
    }
    await expect(tx.$executeRaw`INSERT INTO exchange_rates (currency_code,effective_date,units_per_usd,source) VALUES ('USD','2026-01-01',2,'test')`).rejects.toMatchObject({ code: 'P2010', meta: { code: '3819' } });
  }));

  it('preserves DATE and exact DECIMAL values and permits shared employee email', async () => rolledBack(async tx => {
    const f = await fixture(tx);
    const row = await tx.salaryRecord.findUniqueOrThrow({ where: { employeeId_effectiveDate: { employeeId: f.employee.id, effectiveDate: f.salary.effectiveDate } } });
    expect(row.effectiveDate.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(row.amount.toFixed(2)).toBe('100.00');
    await tx.employee.create({ data: { employeeCode: 'SHARED_EMAIL', name: 'Second Synthetic Employee', email: f.employee.email, hireDate: f.employee.hireDate, designationId: f.designation.id, countryId: f.country.id } });
    const high = await tx.salaryRecord.create({ data: { ...f.salary, amount: '9999999999999.99', effectiveDate: new Date('2025-01-01') } });
    expect(high.amount.toFixed(2)).toBe('9999999999999.99');
  }));

  it('evaluates the approved conversion expression as exact decimal arithmetic', async () => rolledBack(async tx => {
    await tx.$executeRaw`SET SESSION div_precision_increment = 4`;
    const [row] = await tx.$queryRaw<{ converted: Prisma.Decimal }[]>`
      SELECT CAST(CAST(CAST('100.00' AS DECIMAL(15,2)) * CAST('0.91' AS DECIMAL(24,12)) AS DECIMAL(49,24)) / CAST('1.00' AS DECIMAL(24,12)) AS DECIMAL(65,24)) AS converted`;
    expect(row?.converted.toFixed(2)).toBe('91.00');
    // MySQL diagnostics (SHOW WARNINGS / @@warning_count) cannot be prepared.
    // Verify numeric results directly here; text-protocol diagnostics are a separate check.
    const [extreme] = await tx.$queryRaw<{ converted: Prisma.Decimal }[]>`
      SELECT CAST(CAST(CAST('9999999999999.99' AS DECIMAL(15,2)) * CAST('999999999999.999999999999' AS DECIMAL(24,12)) AS DECIMAL(49,24)) / CAST('0.000000000001' AS DECIMAL(24,12)) AS DECIMAL(65,24)) AS converted`;
    const Decimal = Prisma.Decimal.clone({ precision: 100 });
    const expected = new Decimal('9999999999999.99').times('999999999999.999999999999').div('0.000000000001');
    expect(extreme?.converted.toFixed(24)).toBe(expected.toFixed(24));
  }));

  it('loads the complete seed atomically and refuses a second population attempt', async () => rolledBack(async tx => {
    const result = await populateSeed(tx, 'seed-test@example.test', 'not-a-login-fixture');
    expect(result).toEqual({ employeeCount: 10000, salaryCount: 30700, inactiveCount: 400 });
    expect(await tx.department.count()).toBe(8);
    expect(await tx.designation.count()).toBe(24);
    expect(await tx.exchangeRate.count()).toBe(12);
    const [invalid] = await tx.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM salary_records s JOIN employees e ON e.id = s.employee_id WHERE s.effective_date < e.hire_date`;
    expect(Number(invalid?.count)).toBe(0);
    await expect(populateSeed(tx, 'seed-test@example.test', 'not-a-login-fixture')).rejects.toThrow('application tables must all be empty');
    expect(await tx.salaryRecord.count()).toBe(30700);
  }));

  it('leaves no fixture rows committed after rollback', async () => {
    await client.$transaction(tx => assertEmptyDatabase(tx));
  });
});
