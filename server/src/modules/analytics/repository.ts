import { Prisma } from "@prisma/client";
import type { Db } from "../../lib/database.js";
import type { AnalyticsQuery } from "./schemas.js";

// Identifiers are fixed allowlisted fragments; every request value is bound.
export function population(query: AnalyticsQuery, today: Date) {
  const predicates = [
    query.includeInactive ? Prisma.sql`TRUE` : Prisma.sql`e.is_active = 1`,
  ];
  if (query.countryId !== undefined)
    predicates.push(Prisma.sql`e.country_id = ${query.countryId}`);
  if (query.departmentId !== undefined)
    predicates.push(Prisma.sql`d.department_id = ${query.departmentId}`);
  if (query.designationId !== undefined)
    predicates.push(Prisma.sql`e.designation_id = ${query.designationId}`);
  return Prisma.sql`eligible AS (
    SELECT e.id, e.country_id, e.designation_id, d.department_id
    FROM employees e JOIN designations d ON d.id=e.designation_id WHERE ${Prisma.join(predicates, " AND ")}
  ), latest AS (
    SELECT s.employee_id, MAX(s.effective_date) effective_date
    FROM salary_records s JOIN eligible e ON e.id=s.employee_id
    WHERE s.effective_date <= ${today} GROUP BY s.employee_id
  ), population AS (
    SELECT e.*, s.amount, s.currency_code FROM eligible e
    LEFT JOIN latest l ON l.employee_id=e.id
    LEFT JOIN salary_records s ON s.employee_id=l.employee_id AND s.effective_date=l.effective_date
  )`;
}
export type Coverage = {
  currencyCode: string;
  count: bigint;
  maximum: Prisma.Decimal;
};
export function coverage(tx: Db, query: AnalyticsQuery, today: Date) {
  return tx.$queryRaw<Coverage[]>(Prisma.sql`WITH ${population(query, today)}
    SELECT currency_code AS currencyCode, COUNT(*) AS count, MAX(amount) AS maximum
    FROM population WHERE amount IS NOT NULL GROUP BY currency_code ORDER BY currency_code`);
}
export type AggregateRow = {
  groupId: bigint;
  employeeCount: bigint;
  salaryCount: bigint;
  annualBasePayTotal: Prisma.Decimal | null;
  average: Prisma.Decimal | null;
  median: Prisma.Decimal | null;
  min: Prisma.Decimal | null;
  max: Prisma.Decimal | null;
  [key: string]: Prisma.Decimal | bigint | null;
};
export function reportSql(
  query: AnalyticsQuery,
  today: Date,
  rates: Map<string, Prisma.Decimal>,
) {
  const target = rates.get(query.reportingCurrency);
  const cases = [...rates].map(
    ([code, rate]) =>
      Prisma.sql`WHEN ${code} THEN CAST(${rate.toFixed(12)} AS DECIMAL(24,12))`,
  );
  const source = cases.length
    ? Prisma.sql`CASE currency_code ${Prisma.join(cases, " ")} ELSE NULL END`
    : Prisma.sql`NULL`;
  const converted = Prisma.sql`CASE WHEN amount IS NULL THEN NULL
    WHEN currency_code = ${query.reportingCurrency} THEN CAST(amount AS DECIMAL(65,24))
    ELSE CAST(CAST(amount * CAST(${target?.toFixed(12) ?? "1"} AS DECIMAL(24,12)) AS DECIMAL(49,24)) / (${source}) AS DECIMAL(65,24)) END`;
  const groupColumn = {
    none: Prisma.sql`0`,
    country: Prisma.sql`country_id`,
    department: Prisma.sql`department_id`,
    designation: Prisma.sql`designation_id`,
  }[query.groupBy];
  // Keep the converted CTE materialized before duplicating rows for overall/group
  // statistics; otherwise MySQL can push the two-row dimension ahead of salary joins.
  const expanded =
    query.groupBy === "none"
      ? Prisma.sql`SELECT 0 group_id, id, value FROM converted`
      : Prisma.sql`
    SELECT /*+ NO_MERGE(converted) */ CASE WHEN dimension.is_group=0 THEN 0 ELSE ${groupColumn} END group_id, id, value
    FROM converted CROSS JOIN (SELECT 0 is_group UNION ALL SELECT 1) dimension`;
  const buckets = query.bucketBoundaries.map((lower, i) => {
    const upper = query.bucketBoundaries[i + 1];
    return Prisma.sql`SUM(CASE WHEN value >= CAST(${lower} AS DECIMAL(65,24))
      ${upper === undefined ? Prisma.empty : Prisma.sql`AND value < CAST(${upper} AS DECIMAL(65,24))`}
      THEN 1 ELSE 0 END) AS ${Prisma.raw(`bucket${i}`)}`;
  });
  return Prisma.sql`WITH ${population(query, today)}, converted AS (
    SELECT population.*, ${converted} AS value FROM population
  ), expanded AS (${expanded}), ranked AS (
    SELECT *, ROW_NUMBER() OVER ranking rn, COUNT(value) OVER ranking n FROM expanded
    WINDOW ranking AS (PARTITION BY group_id ORDER BY value IS NULL, value, id
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
  ) SELECT group_id AS groupId, COUNT(*) AS employeeCount, COUNT(value) AS salaryCount,
    ROUND(SUM(value),2) AS annualBasePayTotal, ROUND(AVG(value),2) AS average,
    ROUND(AVG(CASE WHEN rn IN (FLOOR((n+1)/2), FLOOR((n+2)/2)) THEN value END),2) AS median,
    ROUND(MIN(value),2) AS min, ROUND(MAX(value),2) AS max, ${Prisma.join(buckets)}
    FROM ranked GROUP BY group_id ORDER BY group_id`;
}
