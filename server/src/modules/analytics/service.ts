import { Prisma, type PrismaClient } from "@prisma/client";
import type { Db } from "../../lib/database.js";
import { ApiError } from "../../lib/errors.js";
import { day, toDate } from "../../lib/validation.js";
import type { AnalyticsQuery, RateQuery } from "./schemas.js";
import {
  ensureDivisionPrecision,
  guardReportRange,
  rethrowNumericError,
} from "./precision.js";
import { coverage, reportSql, type AggregateRow } from "./repository.js";

const Decimal = Prisma.Decimal.clone({
  precision: 100,
  rounding: Prisma.Decimal.ROUND_HALF_UP,
});
type Rate = {
  currencyCode: string;
  unitsPerUsd: Prisma.Decimal;
  effectiveDate: Date;
  source: string;
};
async function validateReporting(tx: Db, query: RateQuery, today: Date) {
  const date = query.reportingDate ? toDate(query.reportingDate) : today;
  if (date > today)
    throw new ApiError(
      422,
      "FUTURE_REPORTING_DATE",
      "Reporting date cannot be after UTC today",
    );
  const currency = await tx.currency.findUnique({
    where: { code: query.reportingCurrency },
  });
  if (!currency?.isActive)
    throw new ApiError(
      422,
      "UNSUPPORTED_CURRENCY",
      "Reporting currency must be supported and active",
    );
  return date;
}
async function selectedRates(tx: Db, date: Date) {
  return tx.$queryRaw<
    Rate[]
  >`SELECT r.currency_code AS currencyCode, r.units_per_usd AS unitsPerUsd,
    r.effective_date AS effectiveDate, r.source
    FROM exchange_rates r JOIN (
      SELECT currency_code, MAX(effective_date) effective_date FROM exchange_rates
      WHERE effective_date <= ${date} GROUP BY currency_code
    ) chosen ON chosen.currency_code=r.currency_code AND chosen.effective_date=r.effective_date
    ORDER BY r.currency_code`;
}
function rateMetadata(rate: Rate, date: Date) {
  return {
    currencyCode: rate.currencyCode,
    unitsPerUsd: rate.unitsPerUsd.toFixed(12),
    effectiveDate: day(rate.effectiveDate),
    source: rate.source,
    ageDays: Math.floor(
      (date.getTime() - rate.effectiveDate.getTime()) / 86400000,
    ),
  };
}
export function exchangeRates(db: PrismaClient, query: RateQuery, today: Date) {
  return db.$transaction(
    async (tx) => {
      const date = await validateReporting(tx, query, today);
      const rates = await selectedRates(tx, date);
      const currencies = await tx.currency.findMany({
        orderBy: { code: "asc" },
      });
      return {
        baseCurrency: "USD",
        reportingCurrency: query.reportingCurrency,
        reportingDate: day(date),
        illustrative: true,
        rates: rates.map((rate) => rateMetadata(rate, date)),
        unavailableCurrencyCodes: currencies
          .filter(
            (currency) =>
              !rates.some((rate) => rate.currencyCode === currency.code),
          )
          .map((currency) => currency.code),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
function summary(row?: AggregateRow) {
  const employeeCount = Number(row?.employeeCount ?? 0);
  const salaryCount = Number(row?.salaryCount ?? 0);
  return {
    employeeCount,
    salaryCount,
    missingSalaryCount: employeeCount - salaryCount,
    annualBasePayTotal: row?.annualBasePayTotal?.toFixed(2) ?? "0.00",
    average: row?.average?.toFixed(2) ?? null,
    median: row?.median?.toFixed(2) ?? null,
    min: row?.min?.toFixed(2) ?? null,
    max: row?.max?.toFixed(2) ?? null,
  };
}
function distribution(query: AnalyticsQuery, row?: AggregateRow) {
  return query.bucketBoundaries.map((lower, index) => ({
    lowerInclusive: new Decimal(lower).toFixed(2),
    upperExclusive:
      query.bucketBoundaries[index + 1] === undefined
        ? null
        : new Decimal(query.bucketBoundaries[index + 1]!).toFixed(2),
    count: Number(row?.[`bucket${index}`] ?? 0),
  }));
}
export async function compensation(
  db: PrismaClient,
  query: AnalyticsQuery,
  today: Date,
) {
  return db
    .$transaction(
      async (tx) => {
        const date = await validateReporting(tx, query, today);
        for (const [field, exists] of [
          [
            "countryId",
            query.countryId === undefined ||
              (await tx.country.count({ where: { id: query.countryId } })) > 0,
          ],
          [
            "departmentId",
            query.departmentId === undefined ||
              (await tx.department.count({
                where: { id: query.departmentId },
              })) > 0,
          ],
          [
            "designationId",
            query.designationId === undefined ||
              (await tx.designation.count({
                where: { id: query.designationId },
              })) > 0,
          ],
        ] as const)
          if (!exists)
            throw new ApiError(422, "UNKNOWN_FILTER", "Unknown filter ID", [
              {
                field,
                code: "NOT_FOUND",
                message: "Referenced filter record not found",
              },
            ]);
        await ensureDivisionPrecision(tx);
        const population = await coverage(tx, query, today);
        const rates = await selectedRates(tx, date);
        const byCode = new Map(rates.map((rate) => [rate.currencyCode, rate]));
        const used = new Set<string>();
        const missing = new Set<string>();
        let affectedEmployeeCount = 0;
        const pairs = population.map(({ currencyCode, count }) => {
          if (currencyCode === query.reportingCurrency)
            return {
              from: currencyCode,
              to: query.reportingCurrency,
              factor: "1",
              identity: true,
            };
          const source = byCode.get(currencyCode);
          const target = byCode.get(query.reportingCurrency);
          if (!source) missing.add(currencyCode);
          if (!target) missing.add(query.reportingCurrency);
          if (!source || !target) {
            affectedEmployeeCount += Number(count);
            return null;
          }
          used.add(currencyCode);
          used.add(query.reportingCurrency);
          return {
            from: currencyCode,
            to: query.reportingCurrency,
            factor: new Decimal(target.unitsPerUsd.toString())
              .div(source.unitsPerUsd.toString())
              .toDecimalPlaces(30)
              .toFixed(),
            identity: false,
            sourceRateDate: day(source.effectiveDate),
            targetRateDate: day(target.effectiveDate),
          };
        });
        if (missing.size)
          throw new ApiError(
            422,
            "MISSING_EXCHANGE_RATES",
            "Required exchange rates are unavailable",
            [
              {
                field: "currencyCodes",
                code: "MISSING",
                message: [...missing].sort().join(","),
              },
              {
                field: "reportingDate",
                code: "REQUESTED_DATE",
                message: day(date),
              },
              {
                field: "affectedEmployeeCount",
                code: "COUNT",
                message: String(affectedEmployeeCount),
              },
            ],
          );
        const rateValues = new Map(
          rates
            .filter((rate) => used.has(rate.currencyCode))
            .map((rate) => [rate.currencyCode, rate.unitsPerUsd]),
        );
        guardReportRange(
          population,
          rateValues,
          query.reportingCurrency,
          query.bucketBoundaries,
        );
        const rows = await tx.$queryRaw<AggregateRow[]>(
          reportSql(query, today, rateValues),
        );
        const master =
          query.groupBy === "country"
            ? await tx.country.findMany()
            : query.groupBy === "department"
              ? await tx.department.findMany()
              : query.groupBy === "designation"
                ? await tx.designation.findMany()
                : [];
        const labels = new Map(master.map((row) => [row.id, row]));
        return {
          salaryAsOfDate: day(today),
          reportingDate: day(date),
          reportingCurrency: query.reportingCurrency,
          includeInactive: query.includeInactive,
          groupBy: query.groupBy,
          summary: summary(rows.find((row) => Number(row.groupId) === 0)),
          groups: rows
            .filter((row) => Number(row.groupId) !== 0)
            .map((row) => {
              const label = labels.get(Number(row.groupId))!;
              return {
                id: label.id,
                code: label.code,
                name: label.name,
                summary: summary(row),
                distribution: distribution(query, row),
              };
            }),
          distribution: distribution(
            query,
            rows.find((row) => Number(row.groupId) === 0),
          ),
          conversion: {
            baseCurrency: "USD",
            illustrative: true,
            rates: rates
              .filter((rate) => used.has(rate.currencyCode))
              .map((rate) => rateMetadata(rate, date)),
            pairs,
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 5000,
        timeout: 15000,
      },
    )
    .catch(rethrowNumericError);
}
