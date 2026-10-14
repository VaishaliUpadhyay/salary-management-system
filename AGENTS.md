# Salary Management System — Codex Instructions

## Mission and source of truth
Build a deployed, tested compensation-management MVP for 10,000 synthetic employees across multiple countries. Primary persona: one authenticated HR Manager. The take-home assesses product thinking, maintainable engineering, tests, deliberate AI use, and incremental commits.

Read `docs/requirements.md` before planning or coding. Use these sources in order: `docs/requirements.md` for product scope, `docs/database-design.md` for agreed schema, `docs/api-contracts.md` for endpoint behavior, and `docs/decisions.md` for trade-offs. `AGENTS.md` governs how you work. If documents conflict, flag the conflict and ask; do not silently reinterpret requirements.

## Stack and architecture
- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts.
- Backend: Node.js, Express, TypeScript; Zod validation.
- Database: MySQL 8.x; Prisma ORM.
- Tests: Vitest and Supertest (or equivalent deterministic API tests).
- Prefer a simple monorepo with `client/` and `server/`, REST APIs, and a modular monolith. No microservices.
- Do not change the stack without asking.

## MVP capabilities
- Create, view, edit, search, filter, and deactivate employees; never hard-delete employees.
- Manage normalized departments, designations, and countries.
- Create append-only salary revisions; show current, historical, and future-dated salary separately.
- Provide employee counts, annual base-pay totals, average, median, min, max, and salary distributions, filtered/grouped by country, department, and designation.
- CSV import with row-level errors and documented partial-success behavior.
- Single HR Manager login/logout, protected API endpoints, and session validation.
- Reporting-currency conversion using seeded/cached exchange rates, with rate date/source displayed.
- Deterministically seed 10,000 realistic, synthetic employees; use server-side pagination and database aggregation.

## Scope boundaries — do not build
- Payroll, taxes, payslips, bank transfers.
- Salary approval workflows, benefits, equity, performance reviews.
- Multi-user administration or role-permission management.
- Audit-log management or automated correction of historical salaries.
- XLSX import, report export, or live exchange-rate API calls.
If a request seems to require these, explain the conflict and ask first.

## Relational database rules
- `departments` (1) -> (N) `designations` (1) -> (N) `employees` (1) -> (N) `salary_records`.
- `countries` (1) -> (N) `employees`.
- `users` (1) -> (N) `salary_records` through `created_by`, if creator attribution is needed.
- `exchange_rates` stores dated, sourced conversion rates independently.
- A designation belongs to exactly one department. Employees reference `designation_id` and `country_id`; derive department through designation instead of duplicating `department_id` on employees.
- Employee codes must be unique. Designation names must be unique within a department. Enforce `UNIQUE(employee_id, effective_date)` for salary records.
- Use foreign keys, sensible indexes for filters/joins, and RESTRICT-style behavior for referenced master records. No hard deletion of salary history.
- Salary amounts use `DECIMAL(15,2)`; rates use sufficiently precise DECIMAL. Never use floating-point storage for money.
- Use transactions for related writes. Do not duplicate current salary in `employees`.
- Current department/designation only; historical organizational assignments are outside scope.

## Salary business rules
- Annual base salary only, not CTC, total compensation, or net pay.
- Amounts are non-negative and have ISO 4217 currency codes.
- One salary record per employee per effective date; existing salary records cannot be edited or deleted via the app.
- Current salary = latest revision with `effective_date <= current UTC date`; future revisions are displayed separately and excluded from current analytics.
- Backdated revisions may be added if their date is unique; history is ordered by effective date. Reject same-date conflicts.
- Dates and the meaning of “today” use UTC; use date-only values for effective dates and avoid timezone shifts.
- Country and currency are independent; do not force a country-to-currency mapping.
- Deactivated employees keep their history and are excluded from active-workforce analytics by default; expose an explicit include-inactive filter where appropriate.
- Do not promise a correction workflow for erroneous historical records; document this MVP limitation.

## Analytics and exchange rates
- All amounts shown in original currency remain unchanged.
- Never add or compare mixed-currency salary amounts without conversion to one explicitly selected reporting currency.
- Use USD as a seeded reference currency for rate storage. Record rate source and effective date.
- Choose the latest available rate on or before the requested reporting date; do not use future rates. Use decimal-safe arithmetic, rounding only at clearly defined display/report boundaries.
- For missing required rates, show a clear error or unavailable state; never invent rates or silently assume parity. Same-currency conversion has factor 1.
- Display selected reporting currency and the actual rate date/source. Seeded exchange rates are illustrative, not live market rates.
- Clearly distinguish current compensation analytics from historical salary revisions. Do not claim historical department-level accuracy without assignment history.
- Calculate analytics from the correct current effective salary for each eligible employee; never aggregate all historical revisions as though they were current.

## CSV import contract
- Validate required fields and formats per row using Zod or equivalent validation.
- Reject duplicate employee IDs within a single file (all affected duplicate rows), with row numbers and reasons.
- New employee: create employee plus initial salary atomically.
- Existing employee, new effective date: create a new salary revision; update employee master fields only according to a documented mapping/policy.
- Existing employee, identical salary/currency/effective date: skip as unchanged. Same-date conflicting salary/currency: reject.
- Use partial success: one transaction per accepted row, preserving atomicity of that row. Continue after row-level validation/business failures.
- Return created, updated, skipped, and rejected counts, plus a row-level error report. Never silently discard rows.
- Re-importing an unchanged file must not create additional salary revisions.
- Apply reasonable file-size/row-count limits; do not store uploaded files indefinitely.

## Authentication and security
- One seeded HR Manager account; no public signup, password-reset flow, or multi-role admin UI.
- Hash passwords with argon2 or bcrypt; never store plaintext credentials or log secrets.
- Use HttpOnly cookies. Set Secure=true on HTTPS production; allow Secure=false only for local HTTP development. Choose SameSite according to deployment origins.
- Protect every compensation and employee endpoint with authentication; validate inputs with Zod.
- Implement CSRF protection appropriate to cookie-based authentication, and narrowly configure credentialed CORS when frontend/backend origins differ.
- Use environment variables; commit `.env.example` but never `.env`, tokens, credentials, or production data.
- Use synthetic employee and salary data in the demo.

## Performance and testing
- Target p95 API latency below 500 ms for common list and analytics queries against 10,000 seeded employees in a documented, repeatable environment; do not assert success without measurements.
- Use indexed filters/joins, database-side aggregation, and server-side pagination. Do not fetch all employees into the browser.
- Seed deterministically with a fixed random seed; reruns must have documented reset/upsert behavior.
- Add fast deterministic tests for salary effective-date logic, future/backdated revisions, unique constraints, CSV import idempotency/partial success, conversion/missing rates, authentication/authorization, and analytics calculations.
- Run relevant tests and lint/typecheck after each milestone; report failures honestly.

## Development workflow and evidence
- Work in small reviewable milestones. First produce schema and API design documents; wait for approval before scaffolding application code.
- Before a milestone: summarize plan, affected files, tests, and assumptions.
- After a milestone: summarize changes, commands run, test results, remaining risks, and suggested commit message.
- Never automatically commit, push, deploy, or perform destructive database operations without explicit approval.
- Keep `docs/ai-usage.md` updated after each milestone with a brief summary of AI assistance and human review. Save meaningful actual prompts in `prompts/`.
- Record trade-offs and deliberate exclusions in `docs/decisions.md`.
- Keep README instructions reproducible: install, env setup, migrations, seeding, tests, development, and deployment.
- Prioritize a working, deployed, tested MVP within the 2–3 day deadline over optional polish.
