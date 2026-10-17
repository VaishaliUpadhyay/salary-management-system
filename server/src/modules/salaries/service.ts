import { Prisma, type PrismaClient, type SalaryRecord } from "@prisma/client";
import type { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { lockEmployee, writeTransaction, type Db } from "../../lib/database.js";
import { day, toDate, pageInfo } from "../../lib/validation.js";
import type { salaryInput, salaryQuery } from "./schemas.js";

export type SalaryInput = z.infer<typeof salaryInput>;
export async function validateCurrency(tx: Db, code: string) {
  const currency = await tx.currency.findUnique({ where: { code } });
  if (!currency?.isActive)
    throw new ApiError(
      422,
      "UNSUPPORTED_CURRENCY",
      "Currency must be supported and active",
    );
}
export function validateHireDate(effectiveDate: Date, hireDate: Date) {
  if (effectiveDate < hireDate)
    throw new ApiError(
      422,
      "SALARY_BEFORE_HIRE_DATE",
      "Salary effective date must be on or after hire date",
    );
}
export function classify(
  effectiveDate: Date,
  currentDate: Date | null,
  today: Date,
) {
  if (effectiveDate > today) return "future";
  return currentDate && effectiveDate.getTime() === currentDate.getTime()
    ? "current"
    : "historical";
}
export function salarySummary(
  row:
    | Pick<SalaryRecord, "id" | "amount" | "currencyCode" | "effectiveDate">
    | undefined
    | null,
) {
  return row
    ? {
        id: row.id,
        amount: row.amount.toFixed(2),
        currencyCode: row.currencyCode,
        effectiveDate: day(row.effectiveDate),
      }
    : null;
}
const withCreator = { creator: { select: { id: true, email: true } } } as const;
function serialize(
  row: SalaryRecord & { creator: { id: number; email: string } },
  currentDate: Date | null,
  today: Date,
) {
  return {
    ...salarySummary(row),
    createdAt: row.createdAt,
    createdBy: row.creator,
    classification: classify(row.effectiveDate, currentDate, today),
  };
}
async function currentSalary(tx: Db, employeeId: number, today: Date) {
  return tx.salaryRecord.findFirst({
    where: { employeeId, effectiveDate: { lte: today } },
    orderBy: { effectiveDate: "desc" },
  });
}
async function requireEmployee(tx: Db, id: number) {
  if (!(await tx.employee.findUnique({ where: { id }, select: { id: true } })))
    throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found");
}
export async function addSalary(
  db: PrismaClient,
  employeeId: number,
  input: SalaryInput,
  userId: number,
  today: Date,
) {
  return writeTransaction(db, async (tx) => {
    const employee = await lockEmployee(tx, employeeId);
    if (!employee.isActive)
      throw new ApiError(
        409,
        "EMPLOYEE_INACTIVE",
        "Inactive employees cannot receive new salary revisions",
      );
    const effectiveDate = toDate(input.effectiveDate);
    validateHireDate(effectiveDate, employee.hireDate);
    if (
      await tx.salaryRecord.findUnique({
        where: { employeeId_effectiveDate: { employeeId, effectiveDate } },
      })
    ) {
      throw new ApiError(
        409,
        "SALARY_DATE_CONFLICT",
        "A salary revision already exists for this date",
      );
    }
    await validateCurrency(tx, input.currencyCode);
    const row = await tx.salaryRecord.create({
      data: { ...input, effectiveDate, employeeId, createdBy: userId },
      include: withCreator,
    });
    const current = await currentSalary(tx, employeeId, today);
    return serialize(row, current?.effectiveDate ?? null, today);
  });
}
export async function salaryHistory(
  db: PrismaClient,
  employeeId: number,
  query: z.infer<typeof salaryQuery>,
  today: Date,
) {
  return db.$transaction(
    async (tx) => {
      await requireEmployee(tx, employeeId);
      const current = await currentSalary(tx, employeeId, today);
      const where: Prisma.SalaryRecordWhereInput = { employeeId };
      if (query.scope === "current") where.id = current?.id ?? 0;
      if (query.scope === "historical")
        where.effectiveDate = {
          lt: current?.effectiveDate ?? toDate("1000-01-01"),
        };
      if (query.scope === "future") where.effectiveDate = { gt: today };
      const total = await tx.salaryRecord.count({ where });
      const rows = await tx.salaryRecord.findMany({
        where,
        include: withCreator,
        orderBy: { effectiveDate: query.scope === "future" ? "asc" : "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });
      return {
        data: rows.map((row) =>
          serialize(row, current?.effectiveDate ?? null, today),
        ),
        pagination: pageInfo(query.page, query.pageSize, total),
        salaryAsOfDate: day(today),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
export async function getSalary(
  db: PrismaClient,
  employeeId: number,
  id: number,
  today: Date,
) {
  return db.$transaction(
    async (tx) => {
      await requireEmployee(tx, employeeId);
      const row = await tx.salaryRecord.findFirst({
        where: { id, employeeId },
        include: withCreator,
      });
      if (!row)
        throw new ApiError(
          404,
          "SALARY_NOT_FOUND",
          "Salary revision not found",
        );
      const current = await currentSalary(tx, employeeId, today);
      return {
        data: serialize(row, current?.effectiveDate ?? null, today),
        salaryAsOfDate: day(today),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
