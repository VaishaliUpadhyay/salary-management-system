import { Prisma } from '@prisma/client';
import { describe, it, expect } from 'vitest';
import { analyticsQuery } from '../src/modules/analytics/schemas.js';
import { guardReportRange, rethrowNumericError } from '../src/modules/analytics/precision.js';

describe('analytics validation and conservative arithmetic bounds', () => {
  it('normalizes reporting currency and uses explicit defaults', () => {
    expect(analyticsQuery.parse({ reportingCurrency: ' usd ' })).toMatchObject({ reportingCurrency: 'USD', includeInactive: false, groupBy: 'none', bucketBoundaries: ['0', '50000', '100000', '150000', '200000'] });
  });
  it('rejects repeated query values and more than 20 buckets', () => {
    expect(analyticsQuery.safeParse({ reportingCurrency: ['USD', 'EUR'] }).success).toBe(false);
    expect(analyticsQuery.safeParse({ reportingCurrency: 'USD', bucketBoundaries: Array.from({ length: 21 }, (_, i) => String(i)).join(',') }).success).toBe(false);
  });
  const rates = new Map([['CAD', new Prisma.Decimal('0.000000000001')], ['CHF', new Prisma.Decimal('999999999999.999999999999')]]);
  const maximum = new Prisma.Decimal('9999999999999.99');
  it('allows the 10,000-person extreme-column bound without clipping', () => {
    expect(() => guardReportRange([{ currencyCode: 'CAD', count: 10000n, maximum }], rates, 'CHF', ['0'])).not.toThrow();
  });
  it('rejects a population whose conservative sum bound exceeds DECIMAL capacity', () => {
    expect(() => guardReportRange([{ currencyCode: 'CAD', count: 10001n, maximum }], rates, 'CHF', ['0'])).toThrow('Report exceeds safe decimal');
  });
  it('rejects an out-of-range boundary before MySQL could clip a SELECT cast', () => {
    expect(() => guardReportRange([], rates, 'CHF', ['0', '1' + '0'.repeat(41)])).toThrow('Report exceeds safe decimal');
  });
  it('maps known database numeric failures and preserves unrelated errors', () => {
    for (const code of ['1264', '1265', '1365', '1690']) {
      const error = new Prisma.PrismaClientKnownRequestError('numeric', { code: 'P2010', clientVersion: '6.19.3', meta: { code } });
      expect(() => rethrowNumericError(error)).toThrow('Report exceeds safe decimal');
    }
    const other = new Error('other'); expect(() => rethrowNumericError(other)).toThrow(other);
  });
});
