# Employee Salary Management System

A compensation-management MVP for one HR Manager, with a deterministic seed of 10,000 synthetic employees across countries, departments and designations. Annual base salary management only; payroll, taxes and payments are outside scope.

**Milestone 2 is complete, human-reviewed and manually tested.** Authentication, employee management and append-only salary backend APIs are implemented. The frontend remains a placeholder; analytics, currency reporting, CSV import and functional frontend screens are pending.

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

Recorded execution: **26 unit tests + 45 MySQL integration tests = 71 passing**, zero failed/skipped; lint, client/backend typechecks/builds and Prisma validation exited 0. Human review and manual testing are complete. [Milestone 2](docs/milestone-2.md) separates dated execution logs from human-reported verification.

Database tests require the existing isolated schema `salary_management_m1_test_20261015` and both test accounts. They refuse nonempty application tables. API fixtures are committed only in that schema for concurrency tests and cleaned up by their owner; schema/seed test fixtures roll back. Do not run suites concurrently against it. Interrupted runs require inspection, not an automatic reset.

The original seed contains **10,000 employees and 30,700 salary records**. Subsequent human manual testing added **2 employees and 3 salary records**. Those additions imply totals of 10,002 and 30,703 relative to the baseline; these are not newly queried counts. No frontend/E2E, CSV, analytics/reporting or latency benchmark suite is implemented yet. Exchange rates are illustrative, not live market data.

Optional read-only database verification:

```bash
npm exec -w server -- tsx prisma/operations/verify-runtime.ts
npm run db:status
```

## Documentation

[Requirements](docs/requirements.md) · [Architecture](docs/architecture.md) · [Database design](docs/database-design.md) · [API contracts](docs/api-contracts.md) · [Decisions](docs/decisions.md) · [Milestone 1](docs/milestone-1.md) · [Milestone 2](docs/milestone-2.md) · [AI usage](docs/ai-usage.md)

No deployment has been completed. Production proxy/TLS configuration, performance measurements and the remaining product features are pending.
