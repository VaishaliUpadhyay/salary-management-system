import { z } from "zod";
import { dateOnly, id, queryId, pagination } from "../../lib/validation.js";
import { salaryInput } from "../salaries/schemas.js";

const fields = {
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().toLowerCase().email().max(254),
  countryId: id,
  designationId: id,
  hireDate: dateOnly,
};


export const createEmployeeInput = z.strictObject({
  ...fields,
  employeeCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{1,50}$/),
  initialSalary: salaryInput,
});


export const updateEmployeeInput = z
  .strictObject(fields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field",
  );
export const employeeQuery = z.strictObject({
  ...pagination,
  q: z.string().trim().min(1).max(100).optional(),
  countryId: queryId.optional(),
  departmentId: queryId.optional(),
  designationId: queryId.optional(),
  status: z.enum(["active", "inactive", "all"]).default("active"),
  sort: z.enum(["employeeCode", "name", "hireDate"]).default("employeeCode"),
  order: z.enum(["asc", "desc"]).default("asc"),
});
