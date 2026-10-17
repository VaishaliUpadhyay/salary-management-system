import { z } from "zod";
import { dateOnly, pagination } from "../../lib/validation.js";

export const salaryInput = z.strictObject({
  amount: z
    .string()
    .regex(
      /^\d{1,13}(\.\d{1,2})?$/,
      "Use a non-negative decimal string with at most 13 integer and 2 fractional digits",
    ),
  currencyCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  effectiveDate: dateOnly,
});
export const salaryQuery = z.strictObject({
  ...pagination,
  scope: z.enum(["all", "current", "historical", "future"]).default("all"),
});
