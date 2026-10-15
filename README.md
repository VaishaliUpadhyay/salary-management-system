# Employee Salary Management System

A full-stack compensation-management MVP designed for a single HR Manager to maintain annual base salaries for **10,000 employees** across multiple countries, departments, and designations.

**Current status:** Milestone 1 complete — project scaffolding, MySQL schema, initial migration, deterministic seed, and initial automated tests. **Authentication, employee/salary APIs, analytics, CSV import, and functional UI are not implemented yet.**

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4; shadcn/ui and Recharts configured |
| Backend | Node.js 24, Express 5, TypeScript, Zod |
| Database | MySQL 8.x, Prisma 6 |
| Testing | Vitest, Supertest, MySQL integration tests |

The architecture is a modular monolith. The MVP covers **compensation management, not payroll**: tax calculations, payslips, benefits, approvals, and payments are out of scope.

## Features and progress

| Area | Status |
|---|---|
| Project scaffolding and database design | Complete |
| Database migration and 10,000-employee seed | Complete |
| Initial automated and database tests | Complete |
| HR authentication and session management | Planned |
| Employee management and append-only salary history | Planned |
| Salary analytics and reporting-currency conversion | Planned |
| CSV import and functional frontend | Planned |

Salary history retains original amounts and currencies. Future reporting will use dated, **illustrative** exchange rates; it will not fetch live market rates.

## Quick start

**Prerequisites:** Node.js 24, npm 11, MySQL 8.x, and separate empty development/test databases for a new installation.

From the repository root:

```bash
npm ci
cp -n server/.env.example server/.env
# Configure server/.env with your own local database URLs and credentials.
npm run db:generate
npm run db:validate
```

Set `DATABASE_URL` (restricted application account), `MIGRATION_DATABASE_URL` (database owner), and `APP_ORIGIN` in `server/.env`. For first-time seeding, also set `SEED_DATABASE_NAME`, `SEED_HR_EMAIL`, and `SEED_HR_PASSWORD` (12–128 characters). For database tests, set `TEST_DATABASE_URL` and `TEST_DATABASE_NAME` to a **separate test schema**.

**For a new, empty development database only**, review the migration and run:

```bash
npm run db:status
npm run db:migrate
npm run db:seed
```

**Do not rerun seeding against the existing populated database.** The seed intentionally refuses populated application tables. Never commit `server/.env` or use destructive reset commands against existing data.

Start development servers:

```bash
npm run dev
```

- Frontend: http://127.0.0.1:5173
- Backend: http://127.0.0.1:3000

At Milestone 1, the frontend is a placeholder and business API routes are not available yet.

## Validation and tests

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
```

`npm test` runs **7 non-database tests**; `npm run test:db` runs **7 MySQL integration tests** against a separately configured, migrated, empty test database. Database test fixtures are rolled back.

### Verified development seed

| Record | Count |
|---|---:|
| Employees | 10,000 |
| Salary revisions | 30,700 |
| Departments / designations | 8 / 24 |
| Countries / currencies | 6 / 6 |
| Exchange rates | 12 |
| HR users | 1 |
| Inactive employees | 400 |

Validated with **MySQL 8.0.46**. The initial migration completed successfully; checks found **0 duplicate employee/effective-date pairs, 0 pre-hire salary records, and 0 negative salaries**. The seven database integration tests passed. See [Milestone 1 results](docs/milestone-1.md) and [pre-Milestone-2 validation](docs/pre-milestone-2-validation.md) for detailed evidence.

**Known limitations:** Restricted runtime database grants have not yet been applied or verified; authentication, business/API tests, frontend behavior tests, complete analytics tests, and performance measurements are pending. The local migration-owner URL must be checked before future migration commands.

## Documentation

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Database design](docs/database-design.md)
- [API contracts](docs/api-contracts.md)
- [Design decisions](docs/decisions.md)
- [AI usage and verification](docs/ai-usage.md)

All seeded employee and exchange-rate data is synthetic. No deployment has been completed.
