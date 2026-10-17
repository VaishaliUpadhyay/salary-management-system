# Employee Salary Management System

A compensation-management MVP for one HR Manager, with a deterministic seed of 10,000 synthetic employees across countries, departments and designations. Annual base salary management only; payroll, taxes and payments are outside scope.

**Milestones 1–4 are complete. The user has confirmed Milestone 4 frontend implementation and manual testing are complete.** The HR workspace includes login, employee management, append-only salary history and compensation dashboards. CSV import remains pending for Milestone 5.

## Stack

React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui and Recharts; Node.js 24, Express 5 and Zod; MySQL 8.x with Prisma 6; Vitest, Testing Library, Supertest and Playwright. The project is a modular monolith with `client/` and `server/` workspaces.

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

## Using the HR workspace

Open http://localhost:5173 and sign in with the locally configured seeded HR Manager account. Do not put credentials in client environment variables. Session cookies are HttpOnly; refresh restores the session and logout revokes it.

- **Overview:** compensation metrics, salary distribution and country/department/designation breakdowns. Select currency, FX date and organizational filters. Employee counts and current-salary coverage are shown separately; rates are illustrative.
- **Employees:** server-paginated search/filter, profile details, create/edit and confirmed deactivation. Filters survive navigation back from details.
- **Salary history:** original amounts/currencies, current and future pay, scoped history and append-only revisions. Future revisions are allowed; pre-hire and inactive-employee revisions are rejected. Existing salaries cannot be edited or deleted.

Layouts support desktop/tablet/mobile, with keyboard-accessible dialogs and loading/error/empty states. Production static hosting must keep the UI and `/api` on the same HTTPS origin; `npm run build` produces artifacts but does not deploy them.

## Implemented APIs

All paths start with `/api/v1`. See [API contracts](docs/api-contracts.md) for payloads and errors.

| Method | Path | Behavior |
|---|---|---|
| GET | `/health` | Public health check |
| GET | `/analytics/compensation` | Current compensation summary, distribution and country/department/designation grouping |
| GET | `/countries`, `/departments`, `/designations` | Paginated authenticated lookup catalogs; status and designation department filters |
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
# Install Chromium once for browser checks:
npm exec -w client -- playwright install chromium
npm run test:browser
npm run lint
npm run typecheck
npm run build
npm run db:validate
```

**Milestone 4 validation: 32 frontend + 32 backend + 86 database + 6 Chromium tests passed (156 total), with lint, TypeScript, builds and Prisma validation passing.** Exact commands/results are recorded in [Milestone 4](docs/milestone-4.md). `npm test` runs frontend component/unit tests and backend tests; `npm run test:frontend` runs only the frontend. Browser tests start Vite on port 5174, use mocked APIs and never change development records. Database integration tests exercise real backend APIs in the isolated schema. The 2026-10-18 pre-commit rerun passed all 156 tests and checks (exit 0); human frontend manual testing is complete.

Database tests require the existing isolated schema `salary_management_m1_test_20261015` and both test accounts. They refuse nonempty application tables. API fixtures are committed only in that schema for concurrency tests and cleaned up by their owner; schema/seed test fixtures roll back. Do not run suites concurrently against it. Interrupted runs require inspection, not an automatic reset.

The original seed contains **10,000 employees and 30,700 salary records**. Subsequent human manual testing added **2 employees and 3 salary records**. Milestone 3 read-only checks confirmed **10,002 employees and 30,703 salary records**. The latest read-only check on 2026-10-18 found **10,002 employees and 30,704 salary records**; no development records were changed during pre-commit validation. Frontend component and Chromium UI tests are implemented; CSV tests and live full-stack browser mutation tests remain pending. Analytics/conversion tests and a repeatable API latency benchmark are implemented. Exchange rates are illustrative, not live market data.

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

[Requirements](docs/requirements.md) · [Architecture](docs/architecture.md) · [Database design](docs/database-design.md) · [API contracts](docs/api-contracts.md) · [Decisions](docs/decisions.md) · [Milestone 1](docs/milestone-1.md) · [Milestone 2](docs/milestone-2.md) · [Milestone 3](docs/milestone-3.md) · [Milestone 4](docs/milestone-4.md) · [AI usage](docs/ai-usage.md)

No deployment has been completed. Production proxy/TLS configuration, production load validation and the remaining product features are pending.
