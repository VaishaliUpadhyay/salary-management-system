# Pre-Milestone-2 validation — 2026-10-15

Scope: documentation and rerunning existing checks only. No feature implementation, migrations, persistent seed, database reset, account/grant changes or commits. Existing development data was queried only. The explicitly selected isolated test schema received transactional fixtures that were rolled back; auto-increment counters there may advance, as documented by the test design.

## Commands executed and results

All commands ran from the repository root with the already installed dependencies. No install/update command was needed.

| Exact npm command | Expansion / target | Actual result | Exit code |
|---|---|---|---:|
| `npm test` | `npm run test -w server` → `vitest run --config vitest.config.ts` | 3 files passed; 7 tests passed; 0 failed/skipped | 0 |
| `npm run test:db` | `npm run test:db -w server` → `vitest run --config vitest.db.config.ts`; process-only test target override below | 1 file passed; 7 tests passed; 0 failed/skipped | 0 |
| `npm run db:validate` | `npm run db:validate -w server` → `prisma validate` | Schema valid; no connection/migration required | 0 |
| `npm run typecheck` | `npm run typecheck --workspaces` → `tsc --noEmit` in client and server | Both passed | 0 |
| `npm run build` | `npm run build --workspaces` → client `tsc --noEmit && vite build`; server `tsc -p tsconfig.build.json` | Both passed | 0 |
| `npm run lint` | `eslint . --max-warnings=0` | Passed; no warnings/errors | 0 |

Tests required sandbox escalation for Supertest loopback access and the local database connection. No credentials were printed. The full command for the database run was:

```sh
node --input-type=module <<'JS'
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
config({ path: 'server/.env', quiet: true });
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.pathname !== '/salary_management_dev') throw new Error('Unexpected development target');
const dev = new PrismaClient({ datasourceUrl: url.href });
const before = { employees: await dev.employee.count(), salaries: await dev.salaryRecord.count() };
url.pathname = '/salary_management_m1_test_20261015';
const test = new PrismaClient({ datasourceUrl: url.href });
try {
  const tables = await test.$queryRaw`SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=DATABASE()`;
  if (tables.length !== 10) throw new Error('Expected previously migrated isolated test schema');
  const result = spawnSync('npm', ['run', 'test:db'], {
    stdio: 'inherit',
    env: { ...process.env, TEST_DATABASE_URL: url.href, TEST_DATABASE_NAME: 'salary_management_m1_test_20261015' },
  });
  console.log('npm run test:db exit code:', result.status);
  process.exitCode = result.status ?? 1;
  const after = { employees: await dev.employee.count(), salaries: await dev.salaryRecord.count() };
  console.log('Development counts before:', JSON.stringify(before));
  console.log('Development counts after:', JSON.stringify(after));
  console.log('Test employees/salaries after rollback:', await test.employee.count(), await test.salaryRecord.count());
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Development counts changed');
} finally {
  await test.$disconnect();
  await dev.$disconnect();
}
JS
```

The wrapper exited 0. It reused the configured local credentials only in memory and selected the existing migrated isolated schema; no `.env` changes were made.

## Captured execution output

Non-database tests:

```text
Test Files  3 passed (3)
     Tests  7 passed (7)
  Duration  788ms (tests 58%, import 35%, transform 5%, worker 2%)
```

Database tests and read-only count comparisons:

```text
Test Files  1 passed (1)
     Tests  7 passed (7)
  Duration  2.50s (tests 99%, import 1%)

npm run test:db exit code: 0
Development counts before: {"employees":10000,"salaries":30700}
Development counts after: {"employees":10000,"salaries":30700}
Test employees/salaries after rollback: 0 0
```

Prisma:

```text
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
The schema at prisma/schema.prisma is valid 🚀
```

TypeScript:

```text
> @salary/client@0.1.0 typecheck
> tsc --noEmit

> @salary/server@0.1.0 typecheck
> tsc --noEmit
```

Build:

```text
vite v8.3.4 building client environment for production...
transforming...
✓ 15 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.37 kB │ gzip:  0.27 kB
dist/assets/index-CJ4_czyN.css    4.92 kB │ gzip:  1.69 kB
dist/assets/index-DE2DxMRM.js   219.61 kB │ gzip: 68.62 kB

✓ built in 127ms

> @salary/server@0.1.0 build
> tsc -p tsconfig.build.json
```

Lint emitted no diagnostics and exited 0. Test/build times are observed run durations, not API performance measurements.

## What these tests cover

- Four seed-fixture tests: reproducibility/counts, references/date uniqueness/nonnegative amounts, current/history/future/zero/inactive/independent-currency cohorts, and illustrative sourced rates.
- Two environment tests: safe invalid-configuration diagnostics and default port behavior.
- One Supertest scaffold test: unimplemented employee route returns 404 without framework header or employee data. This is **not** an authentication/authorization test.
- Seven MySQL tests: employee/date/scoped-name uniqueness; FK/restrict behavior; salary/rate CHECK constraints; DATE/DECIMAL/shared-email behavior; basic/extreme conversion inputs; full seed population/reseed refusal; rollback leaving tables empty.

No currently configured automated suite was omitted. There is no configured frontend automated test suite.

## Tests not implemented yet

Authentication/session/cookie/CSRF/origin/rate-limit tests; employee/master CRUD/search/filter/pagination/deactivation tests; salary-service date/status enforcement, timezone boundaries and concurrency tests; CSV validation/duplicates/limits/partial-success/replay/concurrency tests; complete analytics grouping/median/distribution/FX coverage and rounding tests; restricted-runtime-grant denial tests; frontend component/browser/end-to-end/accessibility tests; and repeatable p95 performance benchmarks.

These gaps correspond to unimplemented features or operator setup. Passing the scaffold, seed and constraint tests does not establish end-to-end MVP correctness. No coverage percentage is claimed.
