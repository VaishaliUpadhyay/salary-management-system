import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hash, argon2id } from 'argon2';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { assertEmptyDatabase } from '../prisma/seed-runner.js';
import { verifyRuntimePermissions } from '../src/lib/runtime-security.js';
import { tokenHash } from '../src/modules/auth/routes.js';

let owner: PrismaClient;
let runtime: PrismaClient;
let app: ReturnType<typeof createApp>;
const origin = 'http://localhost:5173';
let now = new Date('2026-10-15T23:59:59Z');
const clock = () => now;
const prefix = `M2${randomBytes(5).toString('hex').toUpperCase()}`;
const email = `${prefix.toLowerCase()}@example.test`;
const password = randomBytes(24).toString('hex');
let userId: number;
let countryId: number;
let otherCountryId: number;
let departmentId: number;
let designationId: number;
let otherDesignationId: number;
let otherDepartmentId: number;
let cookie: string;
let csrf: string;
let sequence = 0;

function input(overrides: Record<string, unknown> = {}) {
  return { employeeCode: `${prefix}${++sequence}`, name: 'Maya Test', email: 'shared@example.test', countryId, designationId,
    hireDate: '2020-01-01', initialSalary: { amount: '100.00', currencyCode: 'USD', effectiveDate: '2024-01-01' }, ...overrides };
}
function post(path: string, body: object) { return request(app).post(`/api/v1${path}`).set('Cookie', cookie).set('Origin', origin).set('X-CSRF-Token', csrf).send(body); }
function patch(path: string, body: object) { return request(app).patch(`/api/v1${path}`).set('Cookie', cookie).set('Origin', origin).set('X-CSRF-Token', csrf).send(body); }
function get(path: string) { return request(app).get(`/api/v1${path}`).set('Cookie', cookie); }
async function employee(overrides: Record<string, unknown> = {}) {
  const result = await post('/employees', input(overrides));
  expect(result.status).toBe(201);
  return result.body.data as { id: number; employeeCode: string; currentSalary: { id: number; amount: string; currencyCode: string } | null; nextFutureSalary: { effectiveDate: string } | null };
}

beforeAll(async () => {
  const ownerUrl = process.env.TEST_DATABASE_URL;
  const runtimeUrl = process.env.TEST_RUNTIME_DATABASE_URL;
  const name = process.env.TEST_DATABASE_NAME;
  if (!ownerUrl || !runtimeUrl || name !== 'salary_management_m1_test_20261015') throw new Error('Configure the isolated test owner/runtime URLs and exact test database name');
  for (const value of [ownerUrl, runtimeUrl]) if (new URL(value).pathname !== `/${name}`) throw new Error('Test database mismatch');
  owner = new PrismaClient({ datasourceUrl: ownerUrl });
  runtime = new PrismaClient({ datasourceUrl: runtimeUrl });
  await owner.$transaction(tx => assertEmptyDatabase(tx));
  await verifyRuntimePermissions(runtime);
  const user = await owner.user.create({ data: { email, passwordHash: await hash(password, { type: argon2id }) } });
  userId = user.id;
  countryId = (await owner.country.create({ data: { code: 'US', name: 'United States' } })).id;
  otherCountryId = (await owner.country.create({ data: { code: 'IN', name: 'India' } })).id;
  await owner.currency.createMany({ data: [{ code: 'USD', name: 'US Dollar' }, { code: 'EUR', name: 'Euro' }] });
  departmentId = (await owner.department.create({ data: { code: `${prefix}ENG`, name: `${prefix} Engineering` } })).id;
  otherDepartmentId = (await owner.department.create({ data: { code: `${prefix}HR`, name: `${prefix} HR` } })).id;
  designationId = (await owner.designation.create({ data: { code: `${prefix}ENG1`, name: 'Engineer', departmentId } })).id;
  otherDesignationId = (await owner.designation.create({ data: { code: `${prefix}HR1`, name: 'Specialist', departmentId: otherDepartmentId } })).id;
  app = createApp({ db: runtime, origin, clock });
  const response = await request(app).post('/api/v1/auth/login').set('Origin', origin).send({ email, password });
  expect(response.status).toBe(200);
  cookie = String(response.headers['set-cookie']![0]).split(';')[0]!;
  csrf = response.body.data.csrfToken;
});

afterAll(async () => {
  // Target only records created by this suite; no truncate/reset or development access.
  if (owner && userId) {
    const ids = (await owner.employee.findMany({ where: { employeeCode: { startsWith: prefix } }, select: { id: true } })).map(e => e.id);
    await owner.$transaction(async tx => {
      await tx.session.deleteMany({ where: { userId } });
      await tx.salaryRecord.deleteMany({ where: { createdBy: userId, employeeId: { in: ids } } });
      await tx.employee.deleteMany({ where: { id: { in: ids } } });
      await tx.designation.deleteMany({ where: { id: { in: [designationId, otherDesignationId].filter(Boolean) } } });
      await tx.department.deleteMany({ where: { id: { in: [departmentId, otherDepartmentId].filter(Boolean) } } });
      await tx.country.deleteMany({ where: { id: { in: [countryId, otherCountryId].filter(Boolean) } } });
      await tx.currency.deleteMany({ where: { code: { in: ['USD', 'EUR'] } } });
      await tx.user.delete({ where: { id: userId } });
    });
  }
  if (owner) await owner.$disconnect();
  if (runtime) await runtime.$disconnect();
});

describe('authentication and request security', () => {
  it.each([
    ['get', '/countries'], ['get', '/departments'], ['get', '/designations'], ['get', '/employees'], ['post', '/employees'], ['get', '/employees/1'], ['patch', '/employees/1'],
    ['post', '/employees/1/deactivate'], ['get', '/employees/1/salary-records'], ['post', '/employees/1/salary-records'],
    ['get', '/employees/1/salary-records/1'], ['get', '/auth/session'], ['get', '/auth/csrf'], ['post', '/auth/logout'],
  ] as const)('protects anonymous %s %s', async (method, path) => {
    expect((await request(app)[method](`/api/v1${path}`)).status).toBe(401);
  });
  it('sets HttpOnly/SameSite cookies and stores only the authentication token hash', async () => {
    const login = await request(app).post('/api/v1/auth/login').set('Origin', origin).send({ email, password });
    expect(login.status).toBe(200);
    const header = String(login.headers['set-cookie']![0]);
    expect(header.includes('HttpOnly')).toBe(true);
    expect(header.includes('SameSite=Lax')).toBe(true);
    expect(header.includes('Secure')).toBe(false);
    const token = header.split(';')[0]!.split('=')[1]!;
    const row = await owner.session.findUniqueOrThrow({ where: { tokenHash: tokenHash(token) } });
    expect(row.tokenHash === token).toBe(false);
    expect(row.expiresAt.getTime() - now.getTime()).toBe(8 * 3600000);
  });
  it('returns stable session/CSRF data and prevents response caching', async () => {
    const session = await get('/auth/session');
    expect(session.status).toBe(200);
    expect(session.body.data.user.id).toBe(userId);
    expect(session.body.data.csrfToken === csrf).toBe(true);
    expect((await get('/auth/csrf')).body.data.csrfToken === csrf).toBe(true);
    expect(session.headers['cache-control']).toBe('no-store');
    expect(session.body.data.user.passwordHash).toBeUndefined();
  });
  it('rejects missing/wrong/null origins and non-JSON login', async () => {
    for (const badOrigin of ['', 'null', 'https://attacker.test']) {
      const login = request(app).post('/api/v1/auth/login').send({ email, password });
      if (badOrigin) login.set('Origin', badOrigin);
      expect((await login).status).toBe(403);
    }
    expect((await request(app).post('/api/v1/auth/login').set('Origin', origin).type('form').send({ email, password })).status).toBe(415);
  });
  it('rejects forged/missing CSRF and wrong origin on authenticated mutations', async () => {
    expect((await request(app).post('/api/v1/employees').set('Cookie', cookie).set('Origin', origin).send(input())).status).toBe(403);
    expect((await request(app).post('/api/v1/employees').set('Cookie', cookie).set('Origin', origin).set('X-CSRF-Token', '0'.repeat(64)).send(input())).status).toBe(403);
    expect((await request(app).post('/api/v1/employees').set('Cookie', cookie).set('Origin', 'https://attacker.test').set('X-CSRF-Token', csrf).send(input())).status).toBe(403);
  });
  it('rejects forged and expired session cookies', async () => {
    expect((await request(app).get('/api/v1/employees').set('Cookie', `salary_session=${'0'.repeat(64)}`)).status).toBe(401);
    const expiryApp = createApp({ db: runtime, origin, clock: () => new Date(now.getTime() + 8 * 3600000) });
    expect((await request(expiryApp).get('/api/v1/auth/session').set('Cookie', cookie)).status).toBe(401);
  });
  it('rotates sessions on login and revokes cookies on logout', async () => {
    const login = await request(app).post('/api/v1/auth/login').set('Origin', origin).send({ email, password });
    const old = String(login.headers['set-cookie']![0]).split(';')[0]!;
    const replacement = await request(app).post('/api/v1/auth/login').set('Origin', origin).set('Cookie', old).send({ email, password });
    expect((await request(app).get('/api/v1/auth/session').set('Cookie', old)).status).toBe(401);
    const fresh = String(replacement.headers['set-cookie']![0]).split(';')[0]!;
    const logout = await request(app).post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', fresh).set('X-CSRF-Token', replacement.body.data.csrfToken).send({});
    expect(logout.status).toBe(204);
    expect((await request(app).get('/api/v1/auth/session').set('Cookie', fresh)).status).toBe(401);
  });
  it('sets Secure and __Host- cookie settings in production', async () => {
    const prod = createApp({ db: runtime, origin: 'https://salary.example.test', production: true, clock });
    const login = await request(prod).post('/api/v1/auth/login').set('Origin', 'https://salary.example.test').send({ email, password });
    expect(login.status).toBe(200);
    const header = String(login.headers['set-cookie']![0]);
    expect(header.startsWith('__Host-salary_session=')).toBe(true);
    expect(header.includes('Secure')).toBe(true);
    expect(header.includes('Domain=')).toBe(false);
  });
  it('limits failed logins including concurrent attempts and allows retry after the window', async () => {
    let limitNow = new Date(now);
    const limited = createApp({ db: runtime, origin, clock: () => limitNow });
    const responses = await Promise.all(Array.from({ length: 6 }, () => request(limited).post('/api/v1/auth/login').set('Origin', origin).send({ email, password: 'incorrect-password' })));
    expect(responses.filter(r => r.status === 401)).toHaveLength(5);
    expect(responses.filter(r => r.status === 429)).toHaveLength(1);
    expect(Number(responses.find(r => r.status === 429)?.headers['retry-after'])).toBeGreaterThan(0);
    limitNow = new Date(limitNow.getTime() + 15 * 60000);
    expect((await request(limited).post('/api/v1/auth/login').set('Origin', origin).send({ email, password })).status).toBe(200);
  });
});

describe('employee APIs', () => {
  it('atomically creates employee plus initial salary and preserves currency independent of country', async () => {
    const created = await employee({ employeeCode: `${prefix}LOWER`.toLowerCase(), initialSalary: { amount: '123.4', currencyCode: 'eur', effectiveDate: '2024-01-01' } });
    expect(created.employeeCode).toBe(`${prefix}LOWER`);
    expect(created.currentSalary?.amount).toBe('123.40');
    expect(created.currentSalary?.currencyCode).toBe('EUR');
    const detail = await get(`/employees/${created.id}`);
    expect(detail.body.data.designation.department.id).toBe(departmentId);
    expect(detail.body.data.hireDate).toBe('2020-01-01');
  });
  it('rejects duplicate employee codes without adding salary rows', async () => {
    const body = input();
    expect((await post('/employees', body)).status).toBe(201);
    const before = await owner.salaryRecord.count();
    const duplicate = await post('/employees', body);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMPLOYEE_CODE_EXISTS');
    expect(await owner.salaryRecord.count()).toBe(before);
  });
  it('rejects invalid input/reference/pre-hire initial salary without partial employees', async () => {
    for (const body of [input({ countryId: 4294967295 }), input({ designationId: 4294967295 }), input({ initialSalary: { amount: '5', currencyCode: 'ZZZ', effectiveDate: '2024-01-01' } }), input({ hireDate: '2025-01-01' }), input({ departmentId })]) {
      const before = await owner.employee.count();
      expect((await post('/employees', body)).status).toBe(422);
      expect(await owner.employee.count()).toBe(before);
    }
  });
  it('supports literal contains search, AND filters, sorting and database pagination', async () => {
    await employee({ name: `${prefix} Match 100%_literal` });
    await employee({ name: `${prefix} Match Other`, countryId: otherCountryId, designationId: otherDesignationId });
    const filtered = await get(`/employees?q=${prefix}%20Match&countryId=${countryId}&departmentId=${departmentId}&designationId=${designationId}`);
    expect(filtered.body.pagination.total).toBe(1);
    expect((await get('/employees?q=100%25_literal')).body.pagination.total).toBe(1);
    expect((await get(`/employees?q=${prefix}%20Match&departmentId=${otherDepartmentId}&designationId=${designationId}`)).body.pagination.total).toBe(0);
    const page = await get(`/employees?q=${prefix}%20Match&pageSize=1&page=2&sort=name&order=asc`);
    expect(page.body.pagination).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    expect(page.body.data).toHaveLength(1);
    expect((await get(`/employees?q=${prefix}%20Match&page=99`)).body.data).toEqual([]);
    expect((await get('/employees?countryId=4294967295')).status).toBe(422);
  });
  it('updates only mutable master fields and validates referenced assignments', async () => {
    const created = await employee();
    const changed = await patch(`/employees/${created.id}`, { name: 'Updated Name', email: 'Changed@Example.test', countryId: otherCountryId, designationId: otherDesignationId });
    expect(changed.status).toBe(200);
    expect(changed.body.data.email).toBe('changed@example.test');
    expect(changed.body.data.designation.department.id).toBe(otherDepartmentId);
    expect((await patch(`/employees/${created.id}`, { employeeCode: 'NEW' })).status).toBe(422);
    expect((await patch(`/employees/${created.id}`, {})).status).toBe(422);
  });
  it('rejects retired assignments but retains unchanged retired references', async () => {
    const created = await employee();
    await owner.country.update({ where: { id: countryId }, data: { isActive: false } });
    await owner.designation.update({ where: { id: designationId }, data: { isActive: false } });
    try {
      expect((await post('/employees', input())).status).toBe(422);
      expect((await patch(`/employees/${created.id}`, { name: 'Retained', countryId, designationId })).status).toBe(200);
      const other = await employee({ countryId: otherCountryId, designationId: otherDesignationId });
      expect((await patch(`/employees/${other.id}`, { countryId })).status).toBe(422);
      expect((await patch(`/employees/${other.id}`, { designationId })).status).toBe(422);
    } finally {
      await owner.country.update({ where: { id: countryId }, data: { isActive: true } });
      await owner.designation.update({ where: { id: designationId }, data: { isActive: true } });
    }
  });
  it('soft-deactivates idempotently and excludes inactive employees by default', async () => {
    const created = await employee({ name: `${prefix} Inactive` });
    expect((await post(`/employees/${created.id}/deactivate`, {})).body.data.isActive).toBe(false);
    expect((await post(`/employees/${created.id}/deactivate`, {})).status).toBe(200);
    expect((await get(`/employees?q=${prefix}%20Inactive`)).body.data).toHaveLength(0);
    expect((await get(`/employees?q=${prefix}%20Inactive&status=inactive`)).body.data).toHaveLength(1);
    expect((await get(`/employees?q=${prefix}%20Inactive&status=all`)).body.data).toHaveLength(1);
    expect((await get(`/employees/${created.id}/salary-records`)).body.pagination.total).toBe(1);
    expect((await patch(`/employees/${created.id}`, { name: 'Inactive Edited' })).status).toBe(200);
  });
  it('returns consistent errors for malformed requests, queries, IDs and absent resources', async () => {
    const malformed = await request(app).post('/api/v1/employees').set('Cookie', cookie).set('Origin', origin).set('X-CSRF-Token', csrf).type('json').send('{');
    expect(malformed.status).toBe(400);
    for (const path of ['/employees?page=0', '/employees?pageSize=101', '/employees?unexpected=1', '/employees/not-an-id', '/employees/1?unexpected=1', '/auth/session?unexpected=1']) {
      const result = await get(path);
      expect(result.status).toBe(400);
      expect(result.body.error.requestId).toBe(result.headers['x-request-id']);
      expect(Array.isArray(result.body.error.details)).toBe(true);
    }
    expect((await get('/employees/4294967295')).status).toBe(404);
  });
});

describe('append-only salary APIs and races', () => {
  it('separates complete history, current and future revisions and orders backdated inserts', async () => {
    const created = await employee();
    for (const effectiveDate of ['2027-01-01', '2026-10-15', '2023-01-01', '2028-01-01']) {
      expect((await post(`/employees/${created.id}/salary-records`, { amount: '200.00', currencyCode: 'EUR', effectiveDate })).status).toBe(201);
    }
    const all = await get(`/employees/${created.id}/salary-records`);
    expect(all.body.data.map((s: { classification: string }) => s.classification)).toEqual(['future', 'future', 'current', 'historical', 'historical']);
    expect((await get(`/employees/${created.id}/salary-records?scope=current`)).body.data[0].effectiveDate).toBe('2026-10-15');
    expect((await get(`/employees/${created.id}/salary-records?scope=historical`)).body.pagination.total).toBe(2);
    expect((await get(`/employees/${created.id}/salary-records?scope=future`)).body.data.map((s: { effectiveDate: string }) => s.effectiveDate)).toEqual(['2027-01-01', '2028-01-01']);
    const detail = await get(`/employees/${created.id}`);
    expect(detail.body.data.currentSalary.amount).toBe('200.00');
    expect(detail.body.data.nextFutureSalary.effectiveDate).toBe('2027-01-01');
    expect((await get(`/employees/${created.id}/salary-records?pageSize=2&page=2`)).body.data).toHaveLength(2);
    const first = all.body.data[0];
    expect((await get(`/employees/${created.id}/salary-records/${first.id}`)).status).toBe(200);
    const other = await employee();
    expect((await get(`/employees/${other.id}/salary-records/${first.id}`)).status).toBe(404);
  });
  it('supports future hires and zero salary without inventing current compensation', async () => {
    const created = await employee({ hireDate: '2027-01-01', initialSalary: { amount: '0', currencyCode: 'USD', effectiveDate: '2027-01-01' } });
    expect(created.currentSalary).toBeNull();
    expect(created.nextFutureSalary?.effectiveDate).toBe('2027-01-01');
    expect((await get(`/employees/${created.id}/salary-records?scope=current`)).body.pagination.total).toBe(0);
    expect((await get(`/employees/${created.id}/salary-records?scope=historical`)).body.pagination.total).toBe(0);
  });
  it('rejects duplicate dates including identical values', async () => {
    const created = await employee();
    const result = await post(`/employees/${created.id}/salary-records`, { amount: '100.00', currencyCode: 'USD', effectiveDate: '2024-01-01' });
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('SALARY_DATE_CONFLICT');
  });
  it('rejects pre-hire revisions and accepts equality with hire date', async () => {
    const created = await employee();
    const invalid = await post(`/employees/${created.id}/salary-records`, { amount: '25', currencyCode: 'USD', effectiveDate: '2019-12-31' });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('SALARY_BEFORE_HIRE_DATE');
    expect((await post(`/employees/${created.id}/salary-records`, { amount: '25', currencyCode: 'USD', effectiveDate: '2020-01-01' })).status).toBe(201);
  });
  it('rejects every new revision for inactive employees but keeps existing history', async () => {
    const created = await employee();
    await post(`/employees/${created.id}/deactivate`, {});
    for (const effectiveDate of ['2023-01-01', '2027-01-01']) {
      const result = await post(`/employees/${created.id}/salary-records`, { amount: '25', currencyCode: 'USD', effectiveDate });
      expect(result.status).toBe(409);
      expect(result.body.error.code).toBe('EMPLOYEE_INACTIVE');
    }
    expect((await get(`/employees/${created.id}/salary-records`)).body.pagination.total).toBe(1);
  });
  it('rejects hire-date edits invalidating historical or future-only records', async () => {
    const created = await employee();
    expect((await patch(`/employees/${created.id}`, { hireDate: '2024-01-02' })).body.error.code).toBe('HIRE_DATE_CONFLICTS_WITH_SALARY');
    expect((await patch(`/employees/${created.id}`, { hireDate: '2024-01-01' })).status).toBe(200);
    const future = await employee({ hireDate: '2027-01-01', initialSalary: { amount: '25', currencyCode: 'USD', effectiveDate: '2027-01-01' } });
    expect((await patch(`/employees/${future.id}`, { hireDate: '2027-01-02' })).status).toBe(409);
  });
  it('allows exactly one of concurrent same-date revisions', async () => {
    const created = await employee();
    const results = await Promise.all([100, 200].map(amount => post(`/employees/${created.id}/salary-records`, { amount: String(amount), currencyCode: 'USD', effectiveDate: '2025-01-01' })));
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await owner.salaryRecord.count({ where: { employeeId: created.id } })).toBe(2);
  });
  it('serializes salary insertion against deactivation', async () => {
    const created = await employee();
    const [salary, deactivation] = await Promise.all([
      post(`/employees/${created.id}/salary-records`, { amount: '200', currencyCode: 'USD', effectiveDate: '2025-01-01' }),
      post(`/employees/${created.id}/deactivate`, {}),
    ]);
    expect(deactivation.status).toBe(200);
    expect([201, 409]).toContain(salary.status);
    expect(await owner.salaryRecord.count({ where: { employeeId: created.id } })).toBe(salary.status === 201 ? 2 : 1);
    expect((await post(`/employees/${created.id}/salary-records`, { amount: '300', currencyCode: 'USD', effectiveDate: '2026-01-01' })).body.error.code).toBe('EMPLOYEE_INACTIVE');
  });
  it('serializes hire-date edits against backdated revision insertion', async () => {
    const created = await employee();
    const [salary, hire] = await Promise.all([
      post(`/employees/${created.id}/salary-records`, { amount: '200', currencyCode: 'USD', effectiveDate: '2022-01-01' }),
      patch(`/employees/${created.id}`, { hireDate: '2023-01-01' }),
    ]);
    expect([[201, 409], [422, 200]]).toContainEqual([salary.status, hire.status]);
    const saved = await owner.employee.findUniqueOrThrow({ where: { id: created.id } });
    expect(await owner.salaryRecord.count({ where: { employeeId: created.id, effectiveDate: { lt: saved.hireDate } } })).toBe(0);
  });
  it('reclassifies a future salary at UTC midnight without any record rewrite', async () => {
    const created = await employee({ initialSalary: { amount: '25', currencyCode: 'USD', effectiveDate: '2026-10-16' } });
    expect((await get(`/employees/${created.id}/salary-records?scope=current`)).body.pagination.total).toBe(0);
    now = new Date('2026-10-16T00:00:00Z');
    try { expect((await get(`/employees/${created.id}/salary-records?scope=current`)).body.pagination.total).toBe(1); }
    finally { now = new Date('2026-10-15T23:59:59Z'); }
  });
});

describe('restricted database permissions', () => {
  it('denies salary UPDATE and DELETE for the actual API runtime connection', async () => {
    await expect(runtime.$executeRaw`UPDATE salary_records SET amount=amount WHERE 1=0`).rejects.toMatchObject({ code: 'P2010', meta: { code: '1142' } });
    await expect(runtime.$executeRaw`DELETE FROM salary_records WHERE 1=0`).rejects.toMatchObject({ code: 'P2010', meta: { code: '1142' } });
    await expect(verifyRuntimePermissions(runtime)).resolves.toBeUndefined();
    await expect(verifyRuntimePermissions(owner)).rejects.toThrow('Unsafe DATABASE_URL');
  });
});


describe('approved read-only master catalogs', () => {
  it('paginates and sorts countries with a total count', async () => {
    const result = await get('/countries?pageSize=1&page=1');
    expect(result.status).toBe(200);
    expect(result.body.pagination).toEqual({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
    expect(result.body.data[0].name).toBe('India');
    expect((await get('/countries?pageSize=1&page=2')).body.data[0].name).toBe('United States');
  });
  it('filters designations by department and rejects unknown filters', async () => {
    const result = await get(`/designations?departmentId=${departmentId}`);
    expect(result.status).toBe(200);
    expect(result.body.data.map((row: { id: number }) => row.id)).toEqual([designationId]);
    expect((await get('/designations?departmentId=4294967295')).status).toBe(422);
    expect((await get('/countries?departmentId=1')).status).toBe(400);
    expect((await get('/departments?pageSize=101')).status).toBe(400);
  });
  it('defaults to active catalog entries and supports inactive/all', async () => {
    await owner.department.update({ where: { id: departmentId }, data: { isActive: false } });
    try {
      expect((await get('/departments')).body.data.map((row: { id: number }) => row.id)).toEqual([otherDepartmentId]);
      expect((await get('/departments?status=inactive')).body.data.map((row: { id: number }) => row.id)).toEqual([departmentId]);
      expect((await get('/departments?status=all')).body.pagination.total).toBe(2);
    } finally { await owner.department.update({ where: { id: departmentId }, data: { isActive: true } }); }
  });
});
