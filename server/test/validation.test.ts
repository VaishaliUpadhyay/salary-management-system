import { describe, expect, it } from 'vitest';
import { dateOnly } from '../src/lib/validation.js';
import { salaryInput } from '../src/modules/salaries/schemas.js';
import { classify } from '../src/modules/salaries/service.js';
import { cookieName, cookieOptions } from '../src/modules/auth/routes.js';

describe('date-only and salary validation', () => {
  it.each(['2023-02-29', '2024-02-30', '2024-13-01', '2024-01-00', '2026-01-01T00:00:00Z', '0999-01-01'])('rejects invalid date %s', value => {
    expect(dateOnly.safeParse(value).success).toBe(false);
  });
  it.each(['2024-02-29', '1000-01-01', '9999-12-31'])('accepts calendar date %s', value => {
    expect(dateOnly.safeParse(value).success).toBe(true);
  });
  it.each(['-1.00', '1.001', '1e3', '1,000', '10000000000000', 'NaN'])('rejects invalid money %s', amount => {
    expect(salaryInput.safeParse({ amount, currencyCode: 'USD', effectiveDate: '2026-01-01' }).success).toBe(false);
  });
  it('does not accept a numeric JSON salary amount or unknown write fields', () => {
    expect(salaryInput.safeParse({ amount: 100, currencyCode: 'USD', effectiveDate: '2026-01-01' }).success).toBe(false);
    expect(salaryInput.safeParse({ amount: '100', currencyCode: 'USD', effectiveDate: '2026-01-01', createdBy: 1 }).success).toBe(false);
  });
  it('uses UTC midnight, including leap days, for classification', () => {
    const effective = new Date('2024-02-29T00:00:00Z');
    expect(classify(effective, null, new Date('2024-02-28T00:00:00Z'))).toBe('future');
    expect(classify(effective, effective, effective)).toBe('current');
    expect(classify(effective, new Date('2024-03-01T00:00:00Z'), new Date('2024-03-01T00:00:00Z'))).toBe('historical');
  });
  it('configures secure production cookies and local-only insecure cookies', () => {
    expect(cookieName(true)).toBe('__Host-salary_session');
    expect(cookieOptions(true)).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    expect(cookieOptions(false).secure).toBe(false);
  });
});
