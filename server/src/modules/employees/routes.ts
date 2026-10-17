import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { parse, queryId, day, toDate } from "../../lib/validation.js";
import {
  createEmployeeInput,
  updateEmployeeInput,
  employeeQuery,
} from "./schemas.js";
import {
  createEmployee,
  listEmployees,
  getEmployee,
  updateEmployee,
  deactivateEmployee,
} from "./service.js";
import { salaryInput, salaryQuery } from "../salaries/schemas.js";
import { addSalary, salaryHistory, getSalary } from "../salaries/service.js";

export function employeeRoutes(db: PrismaClient) {
  const router = Router();
  router.use((req, _res, next) => {
    const isList =
      ["GET", "HEAD"].includes(req.method) &&
      (req.path === "/" || /^\/[^/]+\/salary-records\/?$/.test(req.path));
    if (!isList) parse(z.strictObject({}), req.query, 400);
    next();
  });

  // List employees
  router.get("/", async (req, res) =>
    res.json(
      await listEmployees(
        db,
        parse(employeeQuery, req.query, 400),
        toDate(day(req.now)),
      ),
    ),
  );

  // Create employee
  router.post("/", async (req, res) => {
    const employee = await createEmployee(
      db,
      parse(createEmployeeInput, req.body),
      req.auth!.user.id,
      toDate(day(req.now)),
    );
    res
      .status(201)
      .location(`/api/v1/employees/${employee.id}`)
      .json({ data: employee, salaryAsOfDate: day(req.now) });
  });

  // Get employee
  router.get("/:id", async (req, res) => {
    const data = await getEmployee(
      db,
      parse(queryId, req.params.id, 400),
      toDate(day(req.now)),
    );
    res.json({ data, salaryAsOfDate: day(req.now) });
  });

  // Update employee
  router.patch("/:id", async (req, res) => {
    const data = await updateEmployee(
      db,
      parse(queryId, req.params.id, 400),
      parse(updateEmployeeInput, req.body),
      toDate(day(req.now)),
    );
    res.json({ data, salaryAsOfDate: day(req.now) });
  });

  // Deactivate employee
  router.post("/:id/deactivate", async (req, res) => {
    parse(z.strictObject({}), req.body);
    const data = await deactivateEmployee(
      db,
      parse(queryId, req.params.id, 400),
      toDate(day(req.now)),
    );
    res.json({ data, salaryAsOfDate: day(req.now) });
  });

  // Get salary records for an employee
  router.get("/:id/salary-records", async (req, res) =>
    res.json(
      await salaryHistory(
        db,
        parse(queryId, req.params.id, 400),
        parse(salaryQuery, req.query, 400),
        toDate(day(req.now)),
      ),
    ),
  );

  // Add a salary record for an employee
  router.post("/:id/salary-records", async (req, res) => {
    const employeeId = parse(queryId, req.params.id, 400);
    const data = await addSalary(
      db,
      employeeId,
      parse(salaryInput, req.body),
      req.auth!.user.id,
      toDate(day(req.now)),
    );
    res
      .status(201)
      .location(`/api/v1/employees/${employeeId}/salary-records/${data.id}`)
      .json({ data, salaryAsOfDate: day(req.now) });
  });

  // Get a specific salary record for an employee
  router.get("/:id/salary-records/:salaryId", async (req, res) =>
    res.json(
      await getSalary(
        db,
        parse(queryId, req.params.id, 400),
        parse(queryId, req.params.salaryId, 400),
        toDate(day(req.now)),
      ),
    ),
  );
  return router;
}
