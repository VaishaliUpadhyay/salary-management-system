# Employee Salary Management System

A compensation-management MVP for one HR Manager, with a deterministic seed of 10,000 synthetic employees across countries, departments and designations. Annual base salary management only; payroll, taxes and payments are outside scope.

**Milestones 2 and 3 are complete. Salary analytics, reporting and currency conversion APIs have been manually verified by the user.** Authentication, employee management, append-only salaries and compensation reporting are available. The frontend remains a placeholder; dashboards and CSV import are pending.

## Stack

React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui and Recharts; Node.js 24, Express 5 and Zod; MySQL 8.x with Prisma 6; Vitest and Supertest. The project is a modular monolith with `client/` and `server/` workspaces.

## Local setup

Prerequisites: Node.js 24, npm 11 and MySQL 8.x. A new installation needs separate, migrated development and test schemas.

```bash
npm ci
cp -n server/.env.example server/.env
# Configure local credentials and environment variables before continuing.
npm run db:generate
npm run db:validate
```

| Environment variable | Purpose |
|---|---|
| `DATABASE_URL` | Restricted runtime account |
| `MIGRATION_DATABASE_URL` | Owner account for migrations and initial seed |
| `APP_ORIGIN` | Exact frontend origin, normally `http://localhost:5173` |
| `NODE_ENV`, `PORT` | Server mode and port; production requires HTTPS origin |
| `SEED_DATABASE_NAME`, `SEED_HR_EMAIL`, `SEED_HR_PASSWORD` | Explicit seed target and HR credentials; password 12–128 characters |
| `TEST_DATABASE_URL`, `TEST_RUNTIME_DATABASE_URL`, `TEST_DATABASE_NAME` | Isolated test owner, restricted test account and schema name |

For a **new, empty development database only**:

```bash
npm run db:status
npm run db:migrate
npm run db:seed
```

Seeding refuses populated application tables. Do not reseed or reset the existing development database. Keep `.env` and credentials out of Git.

Review and apply `server/prisma/operations/runtime-role.sql` as an administrator. Provision a fresh login, grant its scoped role and set the default role, with no additional broad privileges. Provision an equivalent role scoped only to the test schema. The local Docker provisioning helper has already run; it refuses existing accounts and is not a password-rotation tool. See [Milestone 2 evidence](docs/milestone-2.md) for details.

```bash
npm run dev
```

Frontend: http://localhost:5173; backend: http://127.0.0.1:3000. Vite proxies `/api` to the backend; browser requests use the frontend origin, matching `APP_ORIGIN`. Cross-origin deployment is not configured.

## Implemented APIs

All paths start with `/api/v1`. See [API contracts](docs/api-contracts.md) for payloads and errors.

| Method | Path | Behavior |
|---|---|---|
| GET | `/health` | Public health check |
| GET | `/analytics/compensation` | Current compensation summary, distribution and country/department/designation grouping |
| GET | `/currencies` | Supported currency catalog, including retired entries |
| GET | `/exchange-rates` | Dated USD-reference rates, provenance and missing coverage |
| POST | `/auth/login`, `/auth/logout` | HR login and session revocation |
| GET | `/auth/session`, `/auth/csrf` | Session validation and CSRF token |
| GET / POST | `/employees` | Paginated search/filter or employee plus initial salary creation |
| GET / PATCH | `/employees/:id` | Details or mutable master-field updates |
| POST | `/employees/:id/deactivate` | Idempotent soft deactivation |
| GET / POST | `/employees/:id/salary-records` | Paginated history by scope or append revision |
| GET | `/employees/:id/salary-records/:salaryId` | Individual salary revision |

Employee lists support name/email/code search, country/department/designation/status filters and sorting. Inactive employees are excluded by default. Salary history supports `all`, `current`, `historical` and `future` scopes. Amounts are decimal strings; dates use `YYYY-MM-DD` and UTC. Duplicate dates, pre-hire revisions, new revisions for inactive employees and hire-date edits invalidating history are rejected. Employee locking serializes competing modifications. Salary amounts/currencies are preserved; there are no salary edit/delete endpoints.

Login requires JSON and an exact allowed `Origin`. Authenticated mutations also require the session cookie and `X-CSRF-Token`; send `{}` for logout/deactivation. Sessions expire after eight hours. Cookies are HttpOnly/SameSite=Lax, with Secure `__Host-` cookies in HTTPS production. Login failures are rate-limited; the limiter is process-local and trusted-proxy configuration remains a deployment task.

Runtime connections use `DATABASE_URL`; Prisma migrations use `MIGRATION_DATABASE_URL` through `directUrl`. Startup refuses credentials that can UPDATE or DELETE salary history. These denials were verified with MySQL 1142.

## Validation

```bash
npm test
npm run test:db
npm run lint
npm run typecheck
npm run build
npm run db:validate
```

Milestone 3 validation: **32 unit tests + 80 MySQL integration tests = 112 passing**, zero failed/skipped. See [Milestone 3](docs/milestone-3.md) for commands, financial oracles, performance and validation evidence. Milestones 2 and 3 human verification is complete. The pre-commit validation rerun passed all 112 tests, lint, client/backend typechecks and production builds (exit 0).

Database tests require the existing isolated schema `salary_management_m1_test_20261015` and both test accounts. They refuse nonempty application tables. API fixtures are committed only in that schema for concurrency tests and cleaned up by their owner; schema/seed test fixtures roll back. Do not run suites concurrently against it. Interrupted runs require inspection, not an automatic reset.

The original seed contains **10,000 employees and 30,700 salary records**. Subsequent human manual testing added **2 employees and 3 salary records**. Milestone 3 read-only checks confirmed **10,002 employees and 30,703 salary records**. Frontend/E2E and CSV tests remain pending. Analytics/conversion tests and a repeatable API latency benchmark are implemented. Exchange rates are illustrative, not live market data.

Optional read-only database verification:

```bash
npm exec -w server -- tsx prisma/operations/verify-runtime.ts
npm run db:status
```

## Analytics and performance

`/analytics/compensation` requires `reportingCurrency` and supports `reportingDate`, country/department/designation filters, `includeInactive`, `groupBy` and `bucketBoundaries`. SQL computes employee/salary/missing-salary counts, annual total, average, median, min/max and distribution. Current salary always uses UTC today; reporting date selects FX only. Active future hires count as employees with missing current salary. Missing required rates fail the whole monetary report; same-currency conversion needs no rate.

Conversion preserves original values and uses USD-reference DECIMAL arithmetic, with half-up rounding after aggregation. Rates are illustrative and dated. The user-approved Prisma range checks reject unsafe numeric bounds; direct SELECT-warning inspection is unavailable. No live FX service or analytics cache is used.

```bash
# Existing development data only; 1,000 requests/case at concurrency 10.
PERF_DATABASE_NAME=salary_management_dev npm run bench:analytics
# Optional read-only execution-plan inspection.
npm exec -w server -- tsx benchmarks/plan.ts
```

The benchmark verifies employee/salary/FX hashes before and after. It creates and removes only its own temporary authentication session; it never seeds or edits employee/salary records. Results and environment details are recorded in [Milestone 3](docs/milestone-3.md). Final analytics p95 ranged from 31.68 to 500.02 ms; designation grouping narrowly missed the strict under-500-ms target. Local measurements are not a production capacity guarantee.

## Documentation

[Requirements](docs/requirements.md) · [Architecture](docs/architecture.md) · [Database design](docs/database-design.md) · [API contracts](docs/api-contracts.md) · [Decisions](docs/decisions.md) · [Milestone 1](docs/milestone-1.md) · [Milestone 2](docs/milestone-2.md) · [Milestone 3](docs/milestone-3.md) · [AI usage](docs/ai-usage.md)

No deployment has been completed. Production proxy/TLS configuration, production load validation and the remaining product features are pending.
