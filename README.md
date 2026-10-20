# Employee Salary Management System

A compensation-management MVP for one HR Manager, with a deterministic seed of 10,000 synthetic employees across countries, departments and designations. Annual base salary management only; payroll, taxes and payments are outside scope.

**Milestones 1–5 are complete and human manual testing is confirmed. Final QA: NEEDS ATTENTION.** All 321 automated tests and build checks pass. Unfiltered analytics misses the latency target on the current 21,114-employee dataset; deployment/video evidence and the master-data contract scope decision remain outstanding. See [Milestone 6](docs/milestone-6.md).

## Stack

React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui and Recharts; Node.js 24, Express 5 and Zod; MySQL 8.x with Prisma 6; Vitest, Testing Library, Supertest and Playwright. The project is a modular monolith with `client/` and `server/` workspaces.

## Production deployment preparation

The approved Render + Aiven preparation is implemented; **no cloud deployment has been performed**. Production Express serves the built React frontend and API on one origin, with existing hash navigation, strict database TLS configuration and restricted runtime permissions. Follow [the deployment guide](docs/deployment.md) and review [Milestone 7 evidence](docs/milestone-7.md) before creating cloud resources. The local development workflow is unchanged.

## Local setup

Prerequisites: Node.js 24.15+ within 24.x (validated/pinned: 24.20.0), npm 11 (validated: 11.19.0) and MySQL 8.x. Follow the [fresh setup guide](docs/setup.md) for schema creation, both migrations and restricted account provisioning. A new installation needs separate development and test schemas.

```bash
nvm install # optional if Node 24.20.0 is already installed
nvm use
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

Review and apply `server/prisma/operations/runtime-role.sql` as an administrator. Provision a fresh login, grant its scoped role and set the default role, with no additional broad privileges. Provision an equivalent role scoped only to the test schema. The [setup guide](docs/setup.md) includes the explicit test migration and role/login steps; the Docker provisioning helper is optional and refuses existing accounts.

```bash
npm run dev
```

Frontend: http://localhost:5173; backend: http://127.0.0.1:3000. Vite proxies `/api` to the backend; browser requests use the frontend origin, matching `APP_ORIGIN`. Cross-origin deployment is not configured.

## Using the HR workspace

Open http://localhost:5173 and sign in with the locally configured seeded HR Manager account. Do not put credentials in client environment variables. Session cookies are HttpOnly; refresh restores the session and logout revokes it.

- **Overview:** compensation metrics, salary distribution and country/department/designation breakdowns. Select currency, FX date and organizational filters. Employee counts and current-salary coverage are shown separately; rates are illustrative.
- **Employees:** server-paginated search/filter, profile details, create/edit and confirmed deactivation. Filters survive navigation back from details.
- **Import:** upload a UTF-8 CSV up to 5 MiB/10,000 data rows. Existing master fields are never overwritten; identical salary replays skip. Results and downloadable row errors show partial success with readable field labels and actionable messages; diagnostic codes remain in the API/error download. See the [sample and walkthrough](docs/milestone-5.md#manual-walkthrough).
- **Salary history:** original amounts/currencies, current and future pay, scoped history and append-only revisions. Future revisions are allowed; pre-hire and inactive-employee revisions are rejected. Existing salaries cannot be edited or deleted.

Layouts support desktop/tablet/mobile, with keyboard-accessible dialogs and loading/error/empty states. Production static hosting must keep the UI and `/api` on the same HTTPS origin; `npm run build` produces artifacts but does not deploy them.

## Implemented APIs

All paths start with `/api/v1`. See [API contracts](docs/api-contracts.md) for payloads and errors.

| Method | Path | Behavior |
|---|---|---|
| POST | `/imports/employees` | Authenticated multipart CSV import with row transactions and partial-success results |
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

**Final QA: 93 frontend + 97 backend + 116 MySQL integration + 15 Chromium tests passed (321 total), zero failures/skips.** Lint, typechecks, production builds, Prisma validation and migration status passed (all exit 0). `npm audit` reported zero vulnerabilities. A separate clean installation also passed generation, checks, builds and 190 non-database tests. See [actual commands, evidence and limits](docs/milestone-6.md).
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

`npm test` runs frontend component/unit and backend tests. Browser tests start Vite on port 5174 with mocked APIs; real API integration uses the isolated MySQL schema. Human manual testing is reported separately. Full live browser-to-MySQL automation remains pending.

Database tests require the existing isolated schema `salary_management_m1_test_20261015` and both test accounts. They refuse nonempty application tables. API fixtures are committed only in that schema for concurrency tests and cleaned up by their owner; schema/seed test fixtures roll back. Do not run suites concurrently against it. Interrupted runs require inspection, not an automatic reset.

The deterministic seed creates **10,000 employees and 30,700 salary records**. Subsequent manual/CSV testing increased the existing development dataset to **21,114 employees and 41,816 salary records**. Final QA preserved it; the separately proposed cleanup remains unapproved and unexecuted. Exchange rates are illustrative, not live market data.

Optional read-only database verification:

```bash
npm exec -w server -- tsx prisma/operations/verify-runtime.ts
npm run db:status
```

## CSV import

Use multipart field `file` on `POST /api/v1/imports/employees` with the session cookie, allowed Origin and `X-CSRF-Token`. Required headers (arbitrary order):

```csv
employee_code,name,email,country_code,department_code,designation_code,hire_date,annual_base_salary,currency_code,effective_date
```

No status column or master auto-creation. New employees are active; existing masters must match. All duplicate codes in one file reject. New effective dates append salary; identical records skip; conflicts reject. UTF-8/BOM/quoted fields and LF/CRLF are supported. Malformed files fail before writes. HTTP 200 includes `{data:{totalRows,counts:{created,updated,skipped,rejected},rows}}`; interrupted processing may return 503 with completed progress and `processingIncomplete:true` in `data`.

```bash
# Empty isolated TEST_DATABASE_NAME only; removes only harness-owned fixtures.
# Do not run concurrently with test:db.
npm run bench:imports
```

Latest local create/replay times: 100 rows 0.512/0.283 s; 1,000 rows 5.431/2.017 s; 10,000 rows 36.945/22.333 s. Sampled process peak RSS across cases was 269.92 MiB (includes harness/API, excludes MySQL). See [Milestone 6 measurements](docs/milestone-6.md). A timeout may occur after rows commit; inspect records before deliberate reimport. No background jobs or automatic mutation retries. See [Milestone 5](docs/milestone-5.md) for exact evidence, error format, limits, sample and remaining validation boundaries.

## Analytics and performance

`/analytics/compensation` requires `reportingCurrency` and supports `reportingDate`, country/department/designation filters, `includeInactive`, `groupBy` and `bucketBoundaries`. SQL computes employee/salary/missing-salary counts, annual total, average, median, min/max and distribution. Current salary always uses UTC today; reporting date selects FX only. Active future hires count as employees with missing current salary. Missing required rates fail the whole monetary report; same-currency conversion needs no rate.

Conversion preserves original values and uses USD-reference DECIMAL arithmetic, with half-up rounding after aggregation. Rates are illustrative and dated. The user-approved Prisma range checks reject unsafe numeric bounds; direct SELECT-warning inspection is unavailable. No live FX service or analytics cache is used.

```bash
# Existing development data only; 1,000 requests/case at concurrency 10.
PERF_DATABASE_NAME=salary_management_dev PERF_OUTPUT_FILE=../../docs/performance/local-analytics.json npm run bench:analytics
# Optional read-only execution-plan inspection.
npm exec -w server -- tsx benchmarks/plan.ts
```

The benchmark verifies employee/salary/FX hashes before and after. It creates and removes only its own temporary authentication session; it never seeds or edits employee/salary records. Latest [Milestone 6 measurements](docs/milestone-6.md) use 21,114 employees, 1,000 requests per case and concurrency 10: unfiltered analytics p95 **999.15–1,453.67 ms** fails the strict <500 ms target; filtered analytics and employee lists pass. No request failures occurred. This is a local workload measurement, not a production capacity guarantee.

## Documentation

[Requirements](docs/requirements.md) · [Architecture](docs/architecture.md) · [Database design](docs/database-design.md) · [API contracts](docs/api-contracts.md) · [Decisions](docs/decisions.md) · [Milestone 1](docs/milestone-1.md) · [Milestone 2](docs/milestone-2.md) · [Milestone 3](docs/milestone-3.md) · [Milestone 4](docs/milestone-4.md) · [Milestone 5](docs/milestone-5.md) · [Milestone 6](docs/milestone-6.md) · [Fresh setup](docs/setup.md) · [AI usage](docs/ai-usage.md)

No deployment or demo-video evidence is recorded. Same-origin frontend serving and production security configuration are prepared; live proxy/TLS/grant verification and cloud load validation remain pending. Only the three master-data GET lists are implemented; planned master write/detail routes need a scope decision, not an assumption that they exist.

Error handling uses shared, code-based user guidance with compact, accessible field errors and no user-facing technical references. CSV errors retain row numbers, while salary ranges are checked before submission. See [the error-handling audit](docs/error-handling-audit.md) for implementation details and actual validation results.

Milestone 6 presentation corrections and viewport verification are recorded in [the error UI regression report](docs/error-ui-regressions.md).
