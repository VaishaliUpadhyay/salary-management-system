import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, it, expect, vi } from "vitest";
import { HEADERS, parseCsv } from "../src/modules/imports/csv.js";
import {
  importRows,
  IncompleteImport,
} from "../src/modules/imports/service.js";
const rows = parseCsv(
  Buffer.from(
    HEADERS.join(",") +
      "\nA,Maya,maya@example.test,US,ENG,DEV,2020-01-01,100,USD,2024-01-01\nB,Maya,maya@example.test,US,ENG,DEV,2020-01-01,100,USD,2024-01-01",
  ),
);
function fixture() {
  const tx = {
    employee: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
    salaryRecord: { create: vi.fn().mockResolvedValue({ id: 1 }) },
  };
  const db = {
    country: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: 1, code: "US", isActive: true }]),
    },
    department: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: 1, code: "ENG", isActive: true }]),
    },
    designation: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: 1, code: "DEV", departmentId: 1, isActive: true },
        ]),
    },
    currency: {
      findMany: vi.fn().mockResolvedValue([{ code: "USD", isActive: true }]),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ value: 1 }]),
    $transaction: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
  return { db, client: db as unknown as PrismaClient };
}
const deadlock = () =>
  new Prisma.PrismaClientKnownRequestError("test-only", {
    code: "P2034",
    clientVersion: "test",
  });
describe("import interrupted and retryable processing", () => {
  it("returns completed counts without inventing outcomes after infrastructure failure", async () => {
    const { db, client } = fixture();
    db.$transaction
      .mockImplementationOnce(async (work) =>
        work({
          employee: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 7 }),
          },
          salaryRecord: { create: vi.fn().mockResolvedValue({ id: 7 }) },
        }),
      )
      .mockRejectedValueOnce(new Error("private database detail"));
    await expect(importRows(client, rows, 1)).rejects.toMatchObject({
      status: 503,
      code: "IMPORT_INCOMPLETE",
      result: {
        totalRows: 2,
        processingIncomplete: true,
        counts: { created: 1, updated: 0, skipped: 0, rejected: 0 },
        rows: [{ rowNumber: 2, employeeId: 7, outcome: "created" }],
      },
    });
  });
  it("stops after a committed prefix on cancellation", async () => {
    const { client } = fixture();
    let checks = 0;
    await expect(
      importRows(client, rows, 1, () => ++checks > 1),
    ).rejects.toMatchObject({
      result: { counts: { created: 1 }, processingIncomplete: true },
    });
  });
  it("retries a deadlock with bounded attempts and reports only one outcome", async () => {
    const { db, client } = fixture();
    db.$transaction.mockRejectedValueOnce(deadlock());
    const result = await importRows(client, rows.slice(0, 1), 1);
    expect(result.counts.created).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });
  it("rejects exhausted retryable rows and continues if database is usable", async () => {
    const { db, client } = fixture();
    db.$transaction
      .mockRejectedValueOnce(deadlock())
      .mockRejectedValueOnce(deadlock())
      .mockRejectedValueOnce(deadlock());
    const result = await importRows(client, rows, 1);
    expect(result.counts).toEqual({
      created: 1,
      updated: 0,
      skipped: 0,
      rejected: 1,
    });
    expect(result.rows[0]!.retryable).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(4);
  });
  it("returns a safe incomplete result if reference loading fails", async () => {
    const { db, client } = fixture();
    db.country.findMany.mockRejectedValue(new Error("private credentials"));
    try {
      await importRows(client, rows, 1);
      expect.fail("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(IncompleteImport);
      expect(String(error)).not.toContain("private");
      expect((error as IncompleteImport).result.rows).toHaveLength(0);
    }
  });
});
