import { parse } from "csv-parse/sync";
import { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { createEmployeeInput } from "../employees/schemas.js";
import { salaryInput } from "../salaries/schemas.js";
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 10000;
export const HEADERS = [
  "employee_code",
  "name",
  "email",
  "country_code",
  "department_code",
  "designation_code",
  "hire_date",
  "annual_base_salary",
  "currency_code",
  "effective_date",
] as const;
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{1,50}$/);
export const rowSchema = z.strictObject({
  employee_code: createEmployeeInput.shape.employeeCode,
  name: createEmployeeInput.shape.name,
  email: createEmployeeInput.shape.email,
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  department_code: code,
  designation_code: code,
  hire_date: createEmployeeInput.shape.hireDate,
  annual_base_salary: salaryInput.shape.amount,
  currency_code: salaryInput.shape.currencyCode,
  effective_date: salaryInput.shape.effectiveDate,
});
export type Input = z.infer<typeof rowSchema>;
export type Row = {
  rowNumber: number;
  employeeCode: string;
  values: Record<string, string>;
  duplicate: boolean;
};
export function parseCsv(buffer: Buffer): Row[] {
  if (buffer.length > MAX_BYTES)
    throw new ApiError(413, "FILE_TOO_LARGE", "The file is too large. Choose a CSV file no larger than 5 MiB.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new ApiError(400, "INVALID_CSV", "The file encoding is not supported. Save the file as CSV UTF-8 and upload it again.");
  }
  if (text.includes("\0"))
    throw new ApiError(
      400,
      "INVALID_CSV",
      "The file contains unreadable characters. Save a clean copy as CSV UTF-8 and upload it again.",
    );
  let header: string[] | undefined;
  const rows: Row[] = [];
  try {
    parse(text, {
      bom: true,
      skip_empty_lines: false,
      relax_column_count: true,
      max_record_size: MAX_BYTES,
      on_record(record: string[]) {
        if (!header) {
          if (
            record.length !== HEADERS.length ||
            new Set(record).size !== HEADERS.length ||
            HEADERS.some((h) => !record.includes(h))
          )
            throw new ApiError(
              400,
              "INVALID_HEADERS",
              "The column headings are missing, repeated or unexpected. Download the CSV template and use each of its ten headings exactly once.",
            );
          header = record;
          return null;
        }
        if (rows.length >= MAX_ROWS)
          throw new ApiError(
            413,
            "TOO_MANY_ROWS",
            "The file contains too many rows. Upload no more than 10,000 employee rows per file.",
          );
        const blank = record.length === 1 && record[0]!.trim() === "";
        if (!blank && record.length !== HEADERS.length)
          throw new ApiError(
            400,
            "INVALID_CSV",
            "A row has missing or extra columns. Use all ten template columns and put values containing commas inside double quotes.",
          );
        const values = Object.fromEntries(
          header.map((h, i) => [h, (record[i] ?? "").trim()]),
        );
        rows.push({
          rowNumber: rows.length + 2,
          employeeCode: values.employee_code!.toUpperCase(),
          values,
          duplicate: false,
        });
        return null;
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      "INVALID_CSV",
      "The CSV could not be read. Check unmatched double quotes and column separators, or save a fresh CSV UTF-8 copy.",
    );
  }
  if (!header || !rows.length)
    throw new ApiError(
      400,
      "EMPTY_CSV",
      "The file has no employee rows. Add at least one row below the template headings and upload again.",
    );
  const counts = new Map<string, number>();
  for (const row of rows)
    if (row.employeeCode)
      counts.set(row.employeeCode, (counts.get(row.employeeCode) ?? 0) + 1);
  for (const row of rows)
    row.duplicate = (counts.get(row.employeeCode) ?? 0) > 1;
  return rows;
}
