export interface Master {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  departmentId?: number;
}
export interface Currency {
  code: string;
  name: string;
  isActive: boolean;
}
export interface Page<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  salaryAsOfDate?: string;
}
export interface Single<T> {
  data: T;
  salaryAsOfDate?: string;
}
export interface Session {
  user: { id: number; email: string };
  csrfToken: string;
  expiresAt: string;
}
export interface Salary {
  id: number;
  amount: string;
  currencyCode: string;
  effectiveDate: string;
  classification?: "current" | "historical" | "future";
  createdAt?: string;
  createdBy?: { id: number; email: string };
}
export interface Employee {
  id: number;
  employeeCode: string;
  name: string;
  email: string;
  country: Pick<Master, "id" | "code" | "name">;
  designation: Pick<Master, "id" | "code" | "name"> & {
    department: Pick<Master, "id" | "code" | "name">;
  };
  hireDate: string;
  isActive: boolean;
  currentSalary: Salary | null;
  nextFutureSalary: Salary | null;
}
export interface Summary {
  employeeCount: number;
  salaryCount: number;
  missingSalaryCount: number;
  annualBasePayTotal: string;
  average: string | null;
  median: string | null;
  min: string | null;
  max: string | null;
}
export interface Bucket {
  lowerInclusive: string;
  upperExclusive: string | null;
  count: number;
}
export interface Rate {
  currencyCode: string;
  unitsPerUsd: string;
  effectiveDate: string;
  source: string;
  ageDays: number;
}
export interface Report {
  salaryAsOfDate: string;
  reportingDate: string;
  reportingCurrency: string;
  includeInactive: boolean;
  groupBy: string;
  summary: Summary;
  distribution: Bucket[];
  groups: {
    id: number;
    code: string;
    name: string;
    summary: Summary;
    distribution: Bucket[];
  }[];
  conversion: {
    illustrative: boolean;
    rates: Rate[];
    pairs: { from: string; to: string; factor: string; identity: boolean }[];
  };
}
export interface Catalog {
  countries: Master[];
  departments: Master[];
  designations: Master[];
  currencies: Currency[];
}
