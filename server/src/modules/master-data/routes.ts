import { Router } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { pagination, parse, queryId, pageInfo } from "../../lib/validation.js";
const common = {
  ...pagination,
  status: z.enum(["active", "inactive", "all"]).default("active"),
};
export function masterDataRoutes(db: PrismaClient) {
  const router = Router();
  for (const kind of ["countries", "departments", "designations"] as const) {
    router.get(`/${kind}`, async (req, res) => {
      const query = parse(
        z.strictObject({
          ...common,
          ...(kind === "designations"
            ? { departmentId: queryId.optional() }
            : {}),
        }),
        req.query,
        400,
      );
      const departmentId =
        kind === "designations"
          ? parse(queryId.optional(), req.query.departmentId, 400)
          : undefined;
      const result = await db.$transaction(
        async (tx) => {
          if (
            departmentId !== undefined &&
            !(await tx.department.findUnique({ where: { id: departmentId } }))
          )
            throw new ApiError(422, "UNKNOWN_FILTER", "Department not found");
          const where = {
            ...(query.status === "all"
              ? {}
              : { isActive: query.status === "active" }),
            ...(departmentId === undefined ? {} : { departmentId }),
          };
          const options = {
            where,
            orderBy: [{ name: "asc" as const }, { id: "asc" as const }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          };
          const [total, data] =
            kind === "countries"
              ? await Promise.all([
                  tx.country.count({ where }),
                  tx.country.findMany(options),
                ])
              : kind === "departments"
                ? await Promise.all([
                    tx.department.count({ where }),
                    tx.department.findMany(options),
                  ])
                : await Promise.all([
                    tx.designation.count({ where }),
                    tx.designation.findMany(options),
                  ]);
          return {
            data,
            pagination: pageInfo(query.page, query.pageSize, total),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      res.json(result);
    });
  }
  return router;
}
