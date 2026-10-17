import type { Catalog, Employee, Report, Session } from "../src/lib/types";
export const session: Session = {
  user: { id: 1, email: "hr@example.test" },
  csrfToken: "test-csrf-not-a-session-token",
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};
export const catalog: Catalog = {
  countries: [{ id: 1, code: "US", name: "United States", isActive: true }],
  departments: [{ id: 1, code: "ENG", name: "Engineering", isActive: true }],
  designations: [
    { id: 1, code: "DEV", name: "Engineer", departmentId: 1, isActive: true },
  ],
  currencies: [
    { code: "USD", name: "US Dollar", isActive: true },
    { code: "EUR", name: "Euro", isActive: true },
  ],
};
export const employee: Employee = {
  id: 1,
  employeeCode: "EMP001",
  name: "Maya Sharma",
  email: "maya@example.test",
  hireDate: "2020-01-01",
  isActive: true,
  country: catalog.countries[0]!,
  designation: {
    ...catalog.designations[0]!,
    department: catalog.departments[0]!,
  },
  currentSalary: {
    id: 1,
    amount: "75000.00",
    currencyCode: "USD",
    effectiveDate: "2024-01-01",
  },
  nextFutureSalary: {
    id: 2,
    amount: "80000.00",
    currencyCode: "EUR",
    effectiveDate: "2027-01-01",
  },
};
export const report: Report = {
  salaryAsOfDate: "2026-10-17",
  reportingDate: "2026-10-17",
  reportingCurrency: "USD",
  includeInactive: false,
  groupBy: "country",
  summary: {
    employeeCount: 7,
    salaryCount: 4,
    missingSalaryCount: 3,
    annualBasePayTotal: "250.00",
    average: "62.50",
    median: "75.00",
    min: "0.00",
    max: "100.00",
  },
  groups: [
    {
      id: 1,
      code: "US",
      name: "United States",
      summary: {
        employeeCount: 7,
        salaryCount: 4,
        missingSalaryCount: 3,
        annualBasePayTotal: "250.00",
        average: "62.50",
        median: "75.00",
        min: "0.00",
        max: "100.00",
      },
      distribution: [],
    },
  ],
  distribution: [
    { lowerInclusive: "0.00", upperExclusive: "100.00", count: 2 },
    { lowerInclusive: "100.00", upperExclusive: null, count: 2 },
  ],
  conversion: {
    illustrative: true,
    rates: [
      {
        currencyCode: "USD",
        unitsPerUsd: "1.000000000000",
        effectiveDate: "2026-10-01",
        source: "Synthetic test rates",
        ageDays: 16,
      },
    ],
    pairs: [],
  },
};
export const page = <T>(data: T[], current = 1, total = data.length) => ({
  data,
  pagination: {
    page: current,
    pageSize: 25,
    total,
    totalPages: Math.ceil(total / 25),
  },
  salaryAsOfDate: "2026-10-17",
});
