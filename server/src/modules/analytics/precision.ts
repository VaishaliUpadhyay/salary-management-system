import { Prisma } from "@prisma/client";
import type { Db } from "../../lib/database.js";
import { ApiError } from "../../lib/errors.js";
import type { Coverage } from "./repository.js";

// Local clone: never change Prisma's global Decimal settings. Used only for small
// currency-level bounds and metadata, never for workforce aggregation.
const Decimal = Prisma.Decimal.clone({
  precision: 100,
  rounding: Prisma.Decimal.ROUND_UP,
});
export function numericRangeError() {
  return new ApiError(
    422,
    "REPORT_NUMERIC_RANGE_EXCEEDED",
    "Report exceeds safe decimal computation limits",
  );
}
export function guardReportRange(
  population: Coverage[],
  rates: Map<string, Prisma.Decimal>,
  target: string,
  boundaries: string[],
) {
  if (boundaries.some((value) => new Decimal(value).gte("1e41")))
    throw numericRangeError();
  let totalUpperBound = new Decimal(0);
  for (const row of population) {
    let maximum = new Decimal(row.maximum.toString());
    if (maximum.isNegative() || maximum.gte("1e13")) throw numericRangeError();
    if (row.currencyCode !== target) {
      const sourceRate = new Decimal(rates.get(row.currencyCode)!.toString());
      const targetRate = new Decimal(rates.get(target)!.toString());
      if (
        sourceRate.lt("1e-12") ||
        sourceRate.gte("1e12") ||
        targetRate.lt("1e-12") ||
        targetRate.gte("1e12")
      )
        throw numericRangeError();
      maximum = maximum
        .times(targetRate)
        .div(sourceRate)
        .toDecimalPlaces(24, Prisma.Decimal.ROUND_UP);
    }
    // AVG/middle-row AVG have scale 28 and at most 37 integer digits.
    if (maximum.gte("1e37")) throw numericRangeError();
    totalUpperBound = totalUpperBound.plus(maximum.times(row.count.toString()));
  }
  // SUM(DECIMAL(65,24)) retains at most 41 integer digits. A conservative
  // count*maximum bound may reject some otherwise safe heterogeneous populations.
  if (totalUpperBound.gte("1e41")) throw numericRangeError();
}
export async function ensureDivisionPrecision(tx: Db) {
  const [settings] = await tx.$queryRaw<
    { value: number }[]
  >`SELECT @@session.div_precision_increment AS value`;
  if (Number(settings?.value) !== 4) {
    await tx.$executeRaw`SET SESSION div_precision_increment = 4`;
    const [verified] = await tx.$queryRaw<
      { value: number }[]
    >`SELECT @@session.div_precision_increment AS value`;
    if (Number(verified?.value) !== 4)
      throw new ApiError(
        503,
        "REPORT_CONFIGURATION_ERROR",
        "Reporting connection precision is unavailable",
      );
  }
}
export function rethrowNumericError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2010" &&
    ["1264", "1265", "1365", "1690"].includes(String(error.meta?.code))
  )
    throw numericRangeError();
  throw error;
}
