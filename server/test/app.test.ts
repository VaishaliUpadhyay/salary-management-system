import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const db = new PrismaClient(); // No connection is needed for missing-cookie rejection.
const app = createApp({ db, origin: 'http://localhost:5173' });
afterAll(() => db.$disconnect());
it('rejects anonymous employee access without exposing data', async () => {
  const response = await request(app).get('/api/v1/employees');
  expect(response.status).toBe(401);
  expect(response.headers['x-powered-by']).toBeUndefined();
  expect(response.body.error.code).toBe('UNAUTHENTICATED');
  expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
});
it('provides minimal public health status', async () => {
  const response = await request(app).get('/api/v1/health');
  expect(response.body).toEqual({ status: 'ok' });
});
