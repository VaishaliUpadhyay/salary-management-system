import { z } from "zod";
import { Prisma } from "@prisma/client";
import { dateOnly, queryId } from "../../lib/validation.js";

const reporting = {
  reportingCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  reportingDate: dateOnly.optional(),
};
export const rateQuery = z.strictObject(reporting);
const boundary = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
export const analyticsQuery = z.strictObject({
  ...reporting,
  countryId: queryId.optional(),
  departmentId: queryId.optional(),
  designationId: queryId.optional(),
  includeInactive: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  groupBy: z
    .enum(["none", "country", "department", "designation"])
    .default("none"),
  bucketBoundaries: z
    .string()
    .max(1000)
    .default("0,50000,100000,150000,200000")
    .transform((value) => value.split(","))
    .refine(
      (values) =>
        values.length >= 1 &&
        values.length <= 20 &&
        values.every((v) => boundary.test(v)),
      "Use 1–20 nonnegative decimal boundaries with at most two fractional places",
    )
    .refine(
      (values) =>
        values.every((v) => boundary.test(v)) &&
        new Prisma.Decimal(values[0]!).isZero() &&
        values.every(
          (value, index) =>
            index === 0 || new Prisma.Decimal(value).gt(values[index - 1]!),
        ),
      "Boundaries must start at zero and strictly increase",
    ),
});
export type AnalyticsQuery = z.output<typeof analyticsQuery>;
export type RateQuery = z.output<typeof rateQuery>;
