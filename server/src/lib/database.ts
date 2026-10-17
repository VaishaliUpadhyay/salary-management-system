import { Prisma, type PrismaClient } from "@prisma/client";
import { ApiError } from "./errors.js";

export type Db = Prisma.TransactionClient;
export function writeTransaction<T>(
  db: PrismaClient,
  work: (tx: Db) => Promise<T>,
) {
  return db.$transaction(work, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    maxWait: 5000,
    timeout: 10000,
  });
}
export async function lockEmployee(tx: Db, id: number) {
  const rows = await tx.$queryRaw<
    { id: number }[]
  >`SELECT id FROM employees WHERE id = ${id} FOR UPDATE`;
  if (!rows.length)
    throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found");
  return tx.employee.findUniqueOrThrow({ where: { id } });
}
