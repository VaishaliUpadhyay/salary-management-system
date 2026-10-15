import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildSeedData, SEED_DATE } from '../prisma/seed-data.js';

const data = buildSeedData();
describe('deterministic synthetic dataset', () => {
  it('reproduces all 10,000 employees and salary revisions without consulting the clock', () => {
    const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    expect(digest(buildSeedData())).toBe(digest(data));
    expect(data.employees).toHaveLength(10_000);
    expect(data.salaries).toHaveLength(30_700);
    expect(new Set(data.employees.map(e => e.employeeCode)).size).toBe(10_000);
    expect(data.employees[0]?.employeeCode).toBe('EMP00001');
    expect(data.employees.at(-1)?.employeeCode).toBe('EMP10000');
  });

  it('has valid references, distinct employee/date pairs and no pre-hire or negative salaries', () => {
    const keys = new Set<string>();
    for (const row of data.salaries) {
      const employee = data.employees[row.employeeId - 1]!;
      expect(row.effectiveDate.getTime()).toBeGreaterThanOrEqual(employee.hireDate.getTime());
      expect(row.amount).toMatch(/^\d{1,13}\.\d{2}$/);
      expect(data.currencies.some(c => c.code === row.currencyCode)).toBe(true);
      const key = `${row.employeeId}:${row.effectiveDate.toISOString()}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
    for (const employee of data.employees) {
      expect(data.countries.some(c => c.id === employee.countryId)).toBe(true);
      expect(data.designations.some(d => d.id === employee.designationId)).toBe(true);
    }
    for (const designation of data.designations) expect(data.departments.some(d => d.id === designation.departmentId)).toBe(true);
  });

  it('covers historical/current/future, zero, inactive, future-hire and independent currency cases', () => {
    const today = new Date(`${SEED_DATE}T00:00:00Z`);
    const currentIds = new Set(data.salaries.filter(s => s.effectiveDate <= today).map(s => s.employeeId));
    expect(currentIds.size).toBe(9900);
    expect(data.salaries.filter(s => s.effectiveDate > today)).toHaveLength(1000);
    expect(data.inactiveIds).toHaveLength(400);
    expect(data.salaries.some(s => s.amount === '0.00')).toBe(true);
    expect(data.employees.filter(e => e.hireDate > today)).toHaveLength(100);
    expect(data.salaries.some(s => s.currencyCode !== data.currencies[data.employees[s.employeeId - 1]!.countryId - 1]!.code)).toBe(true);
  });

  it('provides sourced positive dated rates and USD identity snapshots', () => {
    expect(data.exchangeRates).toHaveLength(12);
    for (const rate of data.exchangeRates) {
      expect(Number(rate.unitsPerUsd)).toBeGreaterThan(0);
      expect(rate.source).toContain('illustrative');
      if (rate.currencyCode === 'USD') expect(rate.unitsPerUsd).toBe('1');
    }
  });
});
