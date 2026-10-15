import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';

it('does not expose employee data before authentication and business routes exist', async () => {
  const response = await request(createApp()).get('/api/v1/employees');
  expect(response.status).toBe(404);
  expect(response.headers['x-powered-by']).toBeUndefined();
  expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});
