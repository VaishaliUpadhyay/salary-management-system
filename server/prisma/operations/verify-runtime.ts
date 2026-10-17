import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { verifyRuntimePermissions } from "../../src/lib/runtime-security.js";

// Read-only evidence; no login, session creation, migrations or data modification.
const runtime = new PrismaClient();
const testUrl = process.env.TEST_DATABASE_URL;
const test = testUrl ? new PrismaClient({ datasourceUrl: testUrl }) : undefined;
const counts = `SELECT
  (SELECT COUNT(*) FROM employees) AS employees,
  (SELECT COUNT(*) FROM salary_records) AS salaries,
  (SELECT COUNT(*) FROM departments) AS departments,
  (SELECT COUNT(*) FROM designations) AS designations,
  (SELECT COUNT(*) FROM countries) AS countries,
  (SELECT COUNT(*) FROM currencies) AS currencies,
  (SELECT COUNT(*) FROM exchange_rates) AS rates,
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM sessions) AS sessions,
  (SELECT COUNT(*) FROM employees WHERE is_active=0) AS inactive`;
function print(label: string, value: unknown) {
  console.log(
    label,
    JSON.stringify(value, (_, item: unknown) =>
      typeof item === "bigint" ? Number(item) : item,
    ),
  );
}
try {
  print(
    "Runtime identity",
    await runtime.$queryRaw`SELECT DATABASE() AS db, CURRENT_USER() AS account, CURRENT_ROLE() AS activeRole, VERSION() AS mysqlVersion`,
  );
  print("Runtime grants", await runtime.$queryRawUnsafe("SHOW GRANTS"));
  await verifyRuntimePermissions(runtime);
  console.log(
    "Salary UPDATE / DELETE: both denied (MySQL 1142; read-only EXPLAIN checks)",
  );
  const appUrl = new URL(process.env.DATABASE_URL!);
  const migrationUrl = new URL(process.env.MIGRATION_DATABASE_URL!);
  print("Credential separation", {
    distinctAccounts: appUrl.username !== migrationUrl.username,
    sameDatabase: appUrl.pathname === migrationUrl.pathname,
  });
  print("Development counts", await runtime.$queryRawUnsafe(counts));
  print(
    "Development integrity",
    await runtime.$queryRaw`SELECT
    (SELECT COUNT(*) FROM (SELECT employee_id, effective_date FROM salary_records GROUP BY employee_id,effective_date HAVING COUNT(*)>1) duplicates) AS duplicateDates,
    (SELECT COUNT(*) FROM salary_records s JOIN employees e ON e.id=s.employee_id WHERE s.effective_date<e.hire_date) AS preHire,
    (SELECT COUNT(*) FROM salary_records WHERE amount<0) AS negativeSalaries`,
  );
  if (test) print("Isolated test counts", await test.$queryRawUnsafe(counts));
} catch {
  console.error(
    "Read-only verification failed; connection/error details suppressed to protect credentials",
  );
  process.exitCode = 1;
} finally {
  await runtime.$disconnect();
  await test?.$disconnect();
}
