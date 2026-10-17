import { Prisma, type PrismaClient } from "@prisma/client";
import type { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { lockEmployee, writeTransaction, type Db } from "../../lib/database.js";
import { day, toDate, pageInfo } from "../../lib/validation.js";
import {
  salarySummary,
  validateCurrency,
  validateHireDate,
} from "../salaries/service.js";
import type {
  createEmployeeInput,
  updateEmployeeInput,
  employeeQuery,
} from "./schemas.js";

const include = {
  country: true,
  designation: { include: { department: true } },
} as const;
type Employee = Prisma.EmployeeGetPayload<{ include: typeof include }>;
type Summary = {
  id: number;
  employeeId: number;
  amount: Prisma.Decimal;
  currencyCode: string;
  effectiveDate: Date;
};
async function serialize(tx: Db, employees: Employee[], today: Date) {
  if (!employees.length) return [];
  // Only one current and one next-future row per page employee cross the DB boundary.
  const ids = Prisma.join(employees.map((e) => e.id));
  const salaries = await tx.$queryRaw<Summary[]>(Prisma.sql`
    SELECT s.id, s.employee_id AS employeeId, s.amount, s.currency_code AS currencyCode, s.effective_date AS effectiveDate
    FROM salary_records s JOIN (
      SELECT employee_id, MAX(CASE WHEN effective_date <= ${today} THEN effective_date END) AS currentDate,
      MIN(CASE WHEN effective_date > ${today} THEN effective_date END) AS futureDate
      FROM salary_records WHERE employee_id IN (${ids}) GROUP BY employee_id
    ) selected ON selected.employee_id = s.employee_id
      AND (s.effective_date = selected.currentDate OR s.effective_date = selected.futureDate)`);
  const byEmployee = new Map<number, Summary[]>();
  for (const salary of salaries) {
    // MySQL unsigned INT values arrive as bigint in Prisma raw queries.
    const employeeId = Number(salary.employeeId);
    byEmployee.set(employeeId, [
      ...(byEmployee.get(employeeId) ?? []),
      { ...salary, id: Number(salary.id), employeeId },
    ]);
  }
  return employees.map((employee) => {
    const rows = byEmployee.get(employee.id) ?? [];
    const { country, designation } = employee;
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name,
      email: employee.email,
      country: { id: country.id, code: country.code, name: country.name },
      designation: {
        id: designation.id,
        code: designation.code,
        name: designation.name,
        department: {
          id: designation.department.id,
          code: designation.department.code,
          name: designation.department.name,
        },
      },
      hireDate: day(employee.hireDate),
      isActive: employee.isActive,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      currentSalary: salarySummary(rows.find((s) => s.effectiveDate <= today)),
      nextFutureSalary: salarySummary(
        rows.find((s) => s.effectiveDate > today),
      ),
    };
  });
}
async function detail(tx: Db, id: number, today: Date) {
  const employee = await tx.employee.findUnique({ where: { id }, include });
  if (!employee)
    throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found");
  return (await serialize(tx, [employee], today))[0]!;
}
async function activeAssignments(
  tx: Db,
  countryId?: number,
  designationId?: number,
) {
  if (countryId !== undefined) {
    const country = await tx.country.findUnique({ where: { id: countryId } });
    if (!country?.isActive)
      throw new ApiError(
        422,
        "INVALID_COUNTRY",
        "Country must exist and be active",
      );
  }
  if (designationId !== undefined) {
    const designation = await tx.designation.findUnique({
      where: { id: designationId },
      include: { department: true },
    });
    if (!designation?.isActive || !designation.department.isActive)
      throw new ApiError(
        422,
        "INVALID_DESIGNATION",
        "Designation and its department must exist and be active",
      );
  }
}
export async function createEmployee(
  db: PrismaClient,
  input: z.infer<typeof createEmployeeInput>,
  userId: number,
  today: Date,
) {
  return writeTransaction(db, async (tx) => {
    await activeAssignments(tx, input.countryId, input.designationId);
    await validateCurrency(tx, input.initialSalary.currencyCode);
    const hireDate = toDate(input.hireDate);
    const effectiveDate = toDate(input.initialSalary.effectiveDate);
    validateHireDate(effectiveDate, hireDate);
    const { initialSalary, ...fields } = input;
    const employee = await tx.employee.create({
      data: { ...fields, hireDate },
    });
    await tx.salaryRecord.create({
      data: {
        ...initialSalary,
        effectiveDate,
        employeeId: employee.id,
        createdBy: userId,
      },
    });
    return detail(tx, employee.id, today);
  });
}
export async function getEmployee(db: PrismaClient, id: number, today: Date) {
  return db.$transaction((tx) => detail(tx, id, today), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}
export async function updateEmployee(
  db: PrismaClient,
  id: number,
  input: z.infer<typeof updateEmployeeInput>,
  today: Date,
) {
  return writeTransaction(db, async (tx) => {
    const employee = await lockEmployee(tx, id);
    await activeAssignments(
      tx,
      input.countryId !== employee.countryId ? input.countryId : undefined,
      input.designationId !== employee.designationId
        ? input.designationId
        : undefined,
    );
    const hireDate = input.hireDate
      ? toDate(input.hireDate)
      : employee.hireDate;
    if (input.hireDate) {
      const earliest = await tx.salaryRecord.findFirst({
        where: { employeeId: id },
        orderBy: { effectiveDate: "asc" },
      });
      if (earliest && hireDate > earliest.effectiveDate)
        throw new ApiError(
          409,
          "HIRE_DATE_CONFLICTS_WITH_SALARY",
          "Hire date cannot be later than an existing salary effective date",
        );
    }
    const data = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );
    await tx.employee.update({ where: { id }, data: { ...data, hireDate } });
    return detail(tx, id, today);
  });
}
export async function deactivateEmployee(
  db: PrismaClient,
  id: number,
  today: Date,
) {
  return writeTransaction(db, async (tx) => {
    const employee = await lockEmployee(tx, id);
    if (employee.isActive)
      await tx.employee.update({ where: { id }, data: { isActive: false } });
    return detail(tx, id, today);
  });
}
export async function listEmployees(
  db: PrismaClient,
  query: z.infer<typeof employeeQuery>,
  today: Date,
) {
  return db.$transaction(
    async (tx) => {
      for (const [field, exists] of [
        [
          "countryId",
          query.countryId === undefined ||
            (await tx.country.count({ where: { id: query.countryId } })) > 0,
        ],
        [
          "departmentId",
          query.departmentId === undefined ||
            (await tx.department.count({ where: { id: query.departmentId } })) >
              0,
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
      const where: Prisma.EmployeeWhereInput = {};
      if (query.status !== "all") where.isActive = query.status === "active";
      if (query.countryId !== undefined) where.countryId = query.countryId;
      if (query.designationId !== undefined)
        where.designationId = query.designationId;
      if (query.departmentId !== undefined)
        where.designation = { departmentId: query.departmentId };
      if (query.q) {
        // Prisma parameterizes the input; escape LIKE metacharacters for literal contains.
        const q = query.q.replace(/[\\%_]/g, "\\$&");
        where.OR = [
          { name: { contains: q } },
          { email: { contains: q } },
          { employeeCode: { contains: q } },
        ];
      }
      const total = await tx.employee.count({ where });
      const employees = await tx.employee.findMany({
        where,
        include,
        orderBy: [{ [query.sort]: query.order }, { id: query.order }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });
      return {
        data: await serialize(tx, employees, today),
        pagination: pageInfo(query.page, query.pageSize, total),
        salaryAsOfDate: day(today),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
