import { fieldIssues, referenceMessages, domainMessages } from "./messages.js";
import { Prisma, type PrismaClient } from "@prisma/client";
import { ApiError } from "../../lib/errors.js";
import { lockEmployee, writeTransaction, type Db } from "../../lib/database.js";
import { day, toDate } from "../../lib/validation.js";
import { validateHireDate } from "../salaries/service.js";
import { rowSchema, type Input, type Row } from "./csv.js";
export type Issue = { field?: string; code: string; message: string };
export type Outcome = {
  rowNumber: number;
  employeeCode: string;
  outcome: "created" | "updated" | "skipped" | "rejected";
  employeeId?: number;
  errors?: Issue[];
  retryable?: boolean;
};
export type Result = {
  totalRows: number;
  counts: Record<Outcome["outcome"], number>;
  rows: Outcome[];
  processingIncomplete?: boolean;
};
export class IncompleteImport extends ApiError {
  constructor(public result: Result) {
    super(
      503,
      "IMPORT_INCOMPLETE",
      "Processing interrupted; completed rows remain committed. Review results and deliberately reimport.",
    );
  }
}
async function loadReferences(db: PrismaClient) {
  const [countries, departments, designations, currencies] = await Promise.all([
    db.country.findMany(),
    db.department.findMany(),
    db.designation.findMany(),
    db.currency.findMany(),
  ]);
  return {
    countries: new Map(countries.map((v) => [v.code, v])),
    departments: new Map(departments.map((v) => [v.code, v])),
    designations: new Map(designations.map((v) => [v.code, v])),
    currencies: new Map(currencies.map((v) => [v.code, v])),
  };
}
type References = Awaited<ReturnType<typeof loadReferences>>;
function references(input: Input, refs: References) {
  const country = refs.countries.get(input.country_code),
    department = refs.departments.get(input.department_code),
    designation = refs.designations.get(input.designation_code),
    currency = refs.currencies.get(input.currency_code);
  const errors: Issue[] = [];
  for (const [field, value] of [
    ["country_code", country],
    ["department_code", department],
    ["designation_code", designation],
    ["currency_code", currency],
  ] as const)
    if (!value)
      errors.push({
        field,
        code: "UNKNOWN_REFERENCE",
        message: referenceMessages[field]!,
      });
  if (designation && department && designation.departmentId !== department.id)
    errors.push({
      field: "designation_code",
      code: "DEPARTMENT_MISMATCH",
      message: "This designation does not belong to the specified department. Check both codes and use a matching pair.",
    });
  if (errors.length)
    throw new ApiError(422, "INVALID_REFERENCE", "Invalid reference", errors);
  return {
    country: country!,
    department: department!,
    designation: designation!,
    currency: currency!,
  };
}
async function processRow(
  tx: Db,
  input: Input,
  refs: References,
  userId: number,
) {
  const ref = references(input, refs);
  const found = await tx.employee.findUnique({
    where: { employeeCode: input.employee_code },
  });
  const effectiveDate = toDate(input.effective_date),
    hireDate = toDate(input.hire_date);
  let employee = found ? await lockEmployee(tx, found.id) : null;
  if (employee) {
    const comparisons: [string, boolean][] = [
      ["name", employee.name === input.name],
      ["email", employee.email === input.email],
      ["country_code", employee.countryId === ref.country.id],
      ["designation_code", employee.designationId === ref.designation.id],
      ["hire_date", day(employee.hireDate) === input.hire_date],
    ];
    const mismatches = comparisons
      .filter(([, same]) => !same)
      .map(([field]) => ({
        field,
        code: "EMPLOYEE_MASTER_MISMATCH",
        message:
          "This value does not match the existing employee profile. Check your CSV or edit the employee profile before importing; import does not overwrite profile information.",
      }));
    if (mismatches.length)
      throw new ApiError(
        409,
        "EMPLOYEE_MASTER_MISMATCH",
        "Existing master fields must match",
        mismatches,
      );
    const salary = await tx.salaryRecord.findUnique({
      where: {
        employeeId_effectiveDate: { employeeId: employee.id, effectiveDate },
      },
    });
    if (salary) {
      if (
        salary.currencyCode === input.currency_code &&
        salary.amount.equals(input.annual_base_salary)
      )
        return { outcome: "skipped" as const, employeeId: employee.id };
      throw new ApiError(
        409,
        "SALARY_DATE_CONFLICT",
        "A different salary already exists for this effective date",
      );
    }
    if (!employee.isActive)
      throw new ApiError(
        409,
        "EMPLOYEE_INACTIVE",
        "Inactive employees cannot receive new salary revisions",
      );
  }
  validateHireDate(effectiveDate, employee?.hireDate ?? hireDate);
  if (!ref.currency.isActive)
    throw new ApiError(
      422,
      "UNSUPPORTED_CURRENCY",
      "New salaries require an active supported currency",
    );
  if (!employee) {
    if (
      !ref.country.isActive ||
      !ref.department.isActive ||
      !ref.designation.isActive
    )
      throw new ApiError(
        422,
        "INACTIVE_REFERENCE",
        "New employees require active country, department and designation",
      );
    employee = await tx.employee.create({
      data: {
        employeeCode: input.employee_code,
        name: input.name,
        email: input.email,
        countryId: ref.country.id,
        designationId: ref.designation.id,
        hireDate,
      },
    });
  }
  await tx.salaryRecord.create({
    data: {
      employeeId: employee.id,
      createdBy: userId,
      amount: input.annual_base_salary,
      currencyCode: input.currency_code,
      effectiveDate,
    },
  });
  return {
    outcome: found ? ("updated" as const) : ("created" as const),
    employeeId: employee.id,
  };
}
function retryable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2002", "P2034", "P2028", "P2024"].includes(error.code)
  );
}
export async function importRows(
  db: PrismaClient,
  rows: Row[],
  userId: number,
  cancelled = () => false,
): Promise<Result> {
  const result: Result = {
    totalRows: rows.length,
    counts: { created: 0, updated: 0, skipped: 0, rejected: 0 },
    rows: [],
  };
  // Complete field validation for the bounded file before the first write.
  const validated = rows.map(row => ({ row, parsed: rowSchema.safeParse(row.values) }));
  let refs: References;
  try {
    refs = await loadReferences(db);
  } catch {
    throw new IncompleteImport({ ...result, processingIncomplete: true });
  }
  for (const { row, parsed } of validated) {
    if (cancelled())
      throw new IncompleteImport({ ...result, processingIncomplete: true });
    const base = {
      rowNumber: row.rowNumber,
      employeeCode: /^[A-Z0-9_-]{1,50}$/.test(row.employeeCode)
        ? row.employeeCode
        : "",
    };
    let outcome: Outcome;
    if (row.duplicate)
      outcome = {
        ...base,
        outcome: "rejected",
        errors: [
          {
            field: "employee_code",
            code: "DUPLICATE_EMPLOYEE_CODE",
            message:
              "This employee ID appears more than once in the file. Keep one row per employee and upload again; all rows with this ID were rejected.",
          },
        ],
      };
    else if (!parsed.success)
      outcome = {
        ...base,
        outcome: "rejected",
        errors: fieldIssues(parsed.error.issues, row.values),
      };
    else {
      let completed: Outcome | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          completed = {
            ...base,
            ...(await writeTransaction(db, (tx) =>
              processRow(tx, parsed.data, refs, userId),
            )),
          };
          break;
        } catch (error) {
          if (retryable(error) && attempt < 2) continue;
          if (error instanceof ApiError)
            completed = {
              ...base,
              outcome: "rejected",
              errors: error.details.length
                ? error.details
                : [
                    {
                      code: error.code,
                      message: domainMessages[error.code] ?? "This row could not be imported. Review its values and try again.",
                      ...(error.code === "SALARY_BEFORE_HIRE_DATE" ||
                      error.code === "SALARY_DATE_CONFLICT"
                        ? { field: "effective_date" }
                        : {}),
                    },
                  ],
            };
          else if (retryable(error)) {
            // Only continue after exhausted transient failures if the connection is usable.
            try {
              await db.$queryRaw`SELECT 1`;
            } catch {
              throw new IncompleteImport({
                ...result,
                processingIncomplete: true,
              });
            }
            completed = {
              ...base,
              outcome: "rejected",
              retryable: true,
              errors: [
                {
                  code: "ROW_RETRYABLE",
                  message:
                    "This row could not be saved because another change was in progress. Check the employee record, then retry this row.",
                },
              ],
            };
          } else if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2003"
          )
            completed = {
              ...base,
              outcome: "rejected",
              errors: [
                {
                  code: "REFERENCE_CONFLICT",
                  message: "A required employee, account or catalog record is unavailable. Check the records in the system before retrying.",
                },
              ],
            };
          else
            throw new IncompleteImport({
              ...result,
              processingIncomplete: true,
            });
          break;
        }
      }
      outcome = completed!;
    }
    result.rows.push(outcome);
    result.counts[outcome.outcome]++;
  }
  return result;
}
