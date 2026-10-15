import { describe, expect, it } from 'vitest';
import { readEnv } from '../src/lib/env.js';

describe('environment validation', () => {
  it('rejects invalid configuration without exposing connection credentials', () => {
    expect(() => readEnv({ DATABASE_URL: 'secret-value', APP_ORIGIN: 'bad' })).toThrow('Invalid environment fields: DATABASE_URL, APP_ORIGIN');
  });
  it('accepts local settings with safe defaults', () => {
    expect(readEnv({ DATABASE_URL: 'mysql://localhost/demo', APP_ORIGIN: 'http://localhost:5173' }).PORT).toBe(3000);
  });
});
