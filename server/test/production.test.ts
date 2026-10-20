import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { readEnv } from '../src/lib/env.js';
import { validateDemoSeed, validateDatabaseTls } from '../src/lib/production.js';

const dir = mkdtempSync(join(tmpdir(), 'salary-production-test-'));
writeFileSync(join(dir, 'index.html'), '<!doctype html><title>HR workspace</title>');
mkdirSync(join(dir, 'assets'));
writeFileSync(join(dir, 'assets/app.js'), 'export {};');
writeFileSync(join(dir, '.env'), 'must-not-be-served');
const cert = join(dir, 'ca.pem');
writeFileSync(cert, '-----BEGIN CERTIFICATE-----\nfixture only\n-----END CERTIFICATE-----');
const url = `mysql://fixture:placeholder@demo.aivencloud.com:1234/salary_management_demo?sslcert=${encodeURIComponent(cert)}&sslaccept=strict`;
// No Prisma instance or database connection in these tests.
const db = {} as PrismaClient;
const app = createApp({ db, origin: 'https://demo.onrender.com', production: true, frontendDirectory: dir });
afterAll(() => rmSync(dir, { recursive: true, force: true }));
describe('production frontend boundary', () => {
  it('serves the frontend with a same-origin CSP and secure headers', async () => {
    const r = await request(app).get('/');
    expect(r.status).toBe(200); expect(r.text).toContain('HR workspace');
    expect(r.headers['content-security-policy']).toContain("script-src 'self'");
    expect(r.headers['content-security-policy']).not.toContain('unsafe-eval');
    expect(r.headers['strict-transport-security']).toBe('max-age=31536000');
    expect(r.headers['cache-control']).toBe('no-store');
  });
  it('serves immutable assets but never substitutes HTML for missing assets', async () => {
    expect((await request(app).get('/assets/app.js')).headers['cache-control']).toContain('immutable');
    const r = await request(app).get('/assets/missing.js');
    expect(r.status).toBe(404); expect(r.type).toBe('application/json');
  });
  it.each(['/api/missing', '/api/v2/employees', '/api/v1/missing'])('keeps %s out of the frontend', async path => {
    const r = await request(app).get(path).set('Accept', 'text/html');
    expect([401, 404]).toContain(r.status); expect(r.type).toBe('application/json');
    expect(r.headers['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'");
  });
  it.each(['/login', '/dashboard', '/employees/123', '/imports'])('canonicalizes %s into existing hash navigation', async path => {
    expect((await request(app).get(path + '?page=2')).headers.location).toBe('/#' + path + '?page=2');
  });
  it('denies dotfiles and does not change development serving', async () => {
    expect((await request(app).get('/.env')).status).toBe(404);
    expect((await request(createApp({ db, origin: 'http://localhost:5173' })).get('/')).status).toBe(404);
  });
  it('keeps login Origin checks ahead of database access', async () => {
    const r = await request(app).post('/api/v1/auth/login').set('Origin', 'https://evil.example').send({});
    expect(r.status).toBe(403);
  });
  it('does not let a spoofed left-hand forwarded address bypass login limiting', async () => {
    const fake = { user: { findUnique: async () => null } } as unknown as PrismaClient;
    const proxyApp = createApp({ db: fake, origin: 'https://demo.onrender.com', trustProxyHops: 1 });
    for (let i = 0; i < 6; i++) {
      const r = await request(proxyApp).post('/api/v1/auth/login')
        .set('Origin', 'https://demo.onrender.com')
        .set('X-Forwarded-For', `198.51.100.${i}, 203.0.113.10`)
        .send({ email: 'fixture@example.test', password: 'wrong-password' });
      expect(r.status).toBe(i < 5 ? 401 : 429);
    }
  });
  it('requires the build and limits proxy trust to a deliberate single hop', () => {
    expect(() => createApp({ db, origin: 'https://demo.onrender.com', production: true, frontendDirectory: join(dir, 'absent') })).toThrow();
    const trusted = createApp({ db, origin: 'https://demo.onrender.com', trustProxyHops: 1 });
    const trust = trusted.get('trust proxy fn') as (ip: string, hop: number) => boolean;
    expect(trust('127.0.0.1', 0)).toBe(true); expect(trust('203.0.113.5', 1)).toBe(false);
    expect(app.get('trust proxy fn')('127.0.0.1', 0)).toBe(false);
  });
});
describe('production configuration and guarded demo seed', () => {
  it('requires exact HTTPS origin and strict CA-backed database configuration', () => {
    expect(readEnv({ NODE_ENV: 'production', DATABASE_URL: url, APP_ORIGIN: 'https://demo.onrender.com', PORT: '10000' }).PORT).toBe(10000);
    expect(() => readEnv({ NODE_ENV: 'production', DATABASE_URL: url, APP_ORIGIN: 'http://demo.onrender.com' })).toThrow('HTTPS');
    expect(() => readEnv({ DATABASE_URL: url, APP_ORIGIN: 'https://demo.onrender.com/path' })).toThrow();
  });
  it.each([url.replace('strict', 'accept_invalid_certs'), url + '&sslaccept=strict', url.replace(encodeURIComponent(cert), 'missing.pem'), 'mysql://fixture:placeholder@localhost/demo'])('rejects unsafe TLS configuration without echoing its URL', value => {
    expect(() => validateDatabaseTls(value)).toThrow();
    try { validateDatabaseTls(value); } catch (e) { expect(String(e)).not.toContain('placeholder'); }
  });
  it('allows only explicitly acknowledged separate Aiven demo targets', () => {
    const env = { NODE_ENV: 'production', MIGRATION_DATABASE_URL: url, SEED_DATABASE_NAME: 'salary_management_demo', ALLOW_PRODUCTION_DEMO_SEED: 'I_ACKNOWLEDGE_EMPTY_SYNTHETIC_DEMO' };
    expect(() => validateDemoSeed(env)).not.toThrow();
    for (const changes of [{ ALLOW_PRODUCTION_DEMO_SEED: '' }, { SEED_DATABASE_NAME: 'other' }, { MIGRATION_DATABASE_URL: url.replace('demo.aivencloud.com', 'localhost') }, { MIGRATION_DATABASE_URL: url.replace('salary_management_demo', 'salary_management_dev'), SEED_DATABASE_NAME: 'salary_management_dev' }]) expect(() => validateDemoSeed({ ...env, ...changes })).toThrow();
  });
});
