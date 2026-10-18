import "dotenv/config";
import os from "node:os";
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { hash, argon2id } from "argon2";
import request from "supertest";
import { createApp } from "../src/app.js";
import { assertEmptyDatabase } from "../prisma/seed-runner.js";
import { verifyRuntimePermissions } from "../src/lib/runtime-security.js";
import { HEADERS } from "../src/modules/imports/csv.js";
const name = "salary_management_m1_test_20261015";
if (
  process.env.TEST_DATABASE_NAME !== name ||
  !process.env.TEST_DATABASE_URL ||
  !process.env.TEST_RUNTIME_DATABASE_URL
)
  throw new Error("Configure the existing isolated test schema");
for (const value of [
  process.env.TEST_DATABASE_URL,
  process.env.TEST_RUNTIME_DATABASE_URL,
])
  if (new URL(value).pathname !== `/${name}`)
    throw new Error("Refusing non-test database");
const owner = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL,
});
const runtime = new PrismaClient({
  datasourceUrl: process.env.TEST_RUNTIME_DATABASE_URL,
  log: [{ emit: "event", level: "query" }],
});
let queries = 0;
runtime.$on("query", () => queries++);
const prefix = `M5B${randomBytes(4).toString("hex").toUpperCase()}`;
let userId: number | undefined;
const countries: number[] = [],
  departments: number[] = [],
  designations: number[] = [];
let createdCurrencies = false;
try {
  await owner.$transaction((tx) => assertEmptyDatabase(tx));
  await verifyRuntimePermissions(runtime);
  const password = randomBytes(24).toString("hex");
  const email = `${prefix.toLowerCase()}@example.test`;
  userId = (
    await owner.user.create({
      data: { email, passwordHash: await hash(password, { type: argon2id }) },
    })
  ).id;
  countries.push(
    (
      await owner.country.create({
        data: { code: "US", name: "United States" },
      })
    ).id,
    (
      await owner.country.create({
        data: { code: "GB", name: "United Kingdom" },
      })
    ).id,
  );
  await owner.currency.createMany({
    data: [
      { code: "USD", name: "US Dollar" },
      { code: "GBP", name: "Pound" },
    ],
  });
  createdCurrencies = true;
  for (const code of ["ENG", "HR"]) {
    const department = await owner.department.create({
      data: { code: prefix + code, name: prefix + code },
    });
    departments.push(department.id);
    designations.push(
      (
        await owner.designation.create({
          data: {
            code: prefix + code + "1",
            name: "Specialist",
            departmentId: department.id,
          },
        })
      ).id,
    );
  }
  const origin = "http://localhost:5173";
  const app = createApp({ db: runtime, origin });
  const login = await request(app)
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .send({ email, password });
  if (login.status !== 200) throw new Error("Benchmark login failed");
  const cookie = String(login.headers["set-cookie"]![0]).split(";")[0]!;
  const csrf = String(login.body.data.csrfToken);
  const version = await owner.$queryRaw<
    { version: string }[]
  >`SELECT VERSION() AS version`;
  console.log(
    JSON.stringify({
      environment: {
        node: process.version,
        mysql: version[0]!.version,
        platform: os.platform(),
        arch: os.arch(),
        cpu: os.cpus()[0]?.model,
        logicalCpus: os.cpus().length,
        memoryGiB: Math.round(os.totalmem() / 1024 ** 3),
        database: "isolated local Docker MySQL",
        concurrency: 1,
      },
      measurement:
        "Full multipart HTTP response via Supertest, includes parsing/transactions/JSON. RSS samples every 10ms include harness and API, not MySQL.",
    }),
  );
  for (const size of [100, 1000, 10000]) {
    const lines = Array.from({ length: size }, (_, i) =>
      [
        `${prefix}_${size}_${i}`,
        "Synthetic Import Employee",
        `synthetic${i}@example.test`,
        i % 2 ? "GB" : "US",
        prefix + (i % 2 ? "HR" : "ENG"),
        prefix + (i % 2 ? "HR1" : "ENG1"),
        i % 17 === 0 ? "2029-01-01" : "2020-01-01",
        i % 11 === 0 ? "0.00" : `${45000 + i}.25`,
        i % 2 ? "GBP" : "USD",
        i % 17 === 0 ? "2029-01-01" : "2024-01-01",
      ].join(","),
    );
    const body = Buffer.from(HEADERS.join(",") + "\r\n" + lines.join("\r\n"));
    for (const mode of ["create", "replay"] as const) {
      console.log(`Starting ${size}-row ${mode} measurement`);
      const baseline = process.memoryUsage().rss;
      let peak = baseline;
      const timer = setInterval(() => {
        peak = Math.max(peak, process.memoryUsage().rss);
      }, 10);
      const beforeQueries = queries;
      const started = performance.now();
      let response;
      try {
        response = await request(app)
          .post("/api/v1/imports/employees")
          .set("Cookie", cookie)
          .set("Origin", origin)
          .set("X-CSRF-Token", csrf)
          .attach("file", body, "benchmark.csv");
      } finally {
        clearInterval(timer);
      }
      const elapsed = performance.now() - started;
      peak = Math.max(peak, process.memoryUsage().rss);
      if (
        response.status !== 200 ||
        response.body.data.counts[mode === "create" ? "created" : "skipped"] !==
          size ||
        response.body.data.counts.rejected !== 0
      )
        throw new Error(
          "Benchmark import outcome did not match expected counts",
        );
      console.log(
        JSON.stringify({
          rows: size,
          mode,
          httpStatus: response.status,
          milliseconds: Number(elapsed.toFixed(2)),
          counts: response.body.data.counts,
          sqlStatements: queries - beforeQueries,
          baselineRssMiB: Number((baseline / 1024 ** 2).toFixed(2)),
          peakRssMiB: Number((peak / 1024 ** 2).toFixed(2)),
          fileBytes: body.length,
        }),
      );
    }
  }
  console.log(
    JSON.stringify({
      verifiedEmployees: await owner.employee.count({
        where: { employeeCode: { startsWith: prefix } },
      }),
      verifiedSalaries: await owner.salaryRecord.count({
        where: { createdBy: userId },
      }),
    }),
  );
} catch {
  console.error("Import benchmark failed; sensitive error details suppressed");
  process.exitCode = 1;
} finally {
  // Delete only this harness's isolated fixture records, never reset a database.
  if (userId) {
    const fixtureUserId = userId;
    await owner.$transaction(
      async (tx) => {
        await tx.session.deleteMany({ where: { userId: fixtureUserId } });
        await tx.salaryRecord.deleteMany({
          where: {
            createdBy: fixtureUserId,
            employee: { employeeCode: { startsWith: prefix } },
          },
        });
        await tx.employee.deleteMany({
          where: { employeeCode: { startsWith: prefix } },
        });
        await tx.designation.deleteMany({
          where: { id: { in: designations } },
        });
        await tx.department.deleteMany({ where: { id: { in: departments } } });
        await tx.country.deleteMany({ where: { id: { in: countries } } });
        if (createdCurrencies)
          await tx.currency.deleteMany({
            where: { code: { in: ["USD", "GBP"] } },
          });
        await tx.user.delete({ where: { id: fixtureUserId } });
      },
      { timeout: 60000 },
    );
    await owner.$transaction((tx) => assertEmptyDatabase(tx));
    console.log(
      "Isolated benchmark fixture cleanup verified: all application tables empty",
    );
  }
  await owner.$disconnect();
  await runtime.$disconnect();
}
