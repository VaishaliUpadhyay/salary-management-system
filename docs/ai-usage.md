# AI usage record

## 2026-10-15 — Technical design only

- AI assistance: read AGENTS.md, finalized requirements, existing decisions and assessment DOCX (extracted using Python standard-library ZIP/XML); drafted normalized Prisma/MySQL model specification, salary/FX query rules, REST contracts, modular-monolith architecture, test/performance plan and trade-offs.
- Sources: local requirements are product authority. Consulted official Prisma native-type/schema and MySQL query documentation; references are linked in database-design.md. Exact dependency versions and generated schema have not been validated.
- Human input: user confirmed that CSV must leave existing employee master fields unchanged and reject mismatches. All other new technical policies remain proposed for review; do not claim human approval of the design.
- Actual prompt and clarification: [prompts/001-technical-design.md](../prompts/001-technical-design.md).
- Verification: inspected changed-file diff, whitespace and local Markdown links; cross-checked schema/contract date, FX, CSV, auth and status policies. No application tests, lint/typecheck, Prisma validation, migrations or benchmarks were run because this milestone contains documentation only and no application/dependencies exist.
- Constraints respected: no application code, dependency installation, stack change, commit, push, database operation or deployment. Design approval is required before scaffolding.
- Human review pending: schema/integrity, query precision and FX semantics, API behaviors, proposed policy choices, security flow and implementation sequencing. Performance and hosting timeout remain unverified.

## 2026-10-15 — Requested final design adjustments

- Human direction: reject pre-hire salaries and new salary revisions for inactive employees; preserve future hires/revisions and history; verify DECIMAL behavior; retain CSV with explicit timeout risk; simplify secure authentication. Actual prompt saved in [002-design-adjustments.md](../prompts/002-design-adjustments.md).
- AI assistance: updated all four design documents consistently, added the hire-date edit/concurrency guard and inactive CSV no-write replay behavior, replaced underspecified factor arithmetic with explicitly typed multiply-then-divide SQL, and simplified authentication to direct session/CSRF middleware.
- Verification: checked official MySQL 8.0 DECIMAL, arithmetic, aggregate and rounding documentation (linked in database design); independently checked extreme range bounds with Python standard-library Decimal at 120-digit precision. These checks passed but are not MySQL execution tests. Checked local Markdown links, code fences, whitespace and stale-rule wording.
- No application code, dependencies, migrations, database queries, commits or pushes. Running-MySQL expression/aggregate tests and connection settings remain implementation validation. Revised documents await implementation approval; user-requested business rules are confirmed.

## 2026-10-15 — Milestone 1 implementation

- Human authorization: technical design approved; scaffolding, Prisma schema/migration and seed implementation authorized. No approval to reset existing databases, commit, push or deploy. Actual prompt saved in [003-milestone-1.md](../prompts/003-milestone-1.md).
- AI assistance: created npm workspace scaffold, all nine Prisma models, reviewed generated migration with custom constraints/collations, deterministic synthetic generator and transactional empty-database seed, environment/setup scripts and initial tests. No business routes or frontend features implemented.
- Deliberate choices: preserve approved stack; pin Prisma 6.19.3 and dependencies; patch deepmerge-ts tooling advisory with a locked override; keep owner/runtime credentials separate; fail closed on missing database test settings rather than claiming skipped checks passed.
- Validation: schema generation/validation, both TypeScript checks/builds, ESLint, seven fast/Supertest tests, native argon2id hash/verify and dependency audit passed. Initial missing-environment, duplicate-field diagnostic and sandbox listener/cache issues were identified and addressed. Audit reports zero vulnerabilities after the override.
- Limits: no configured database and stopped Docker engine; seven live MySQL checks could not execute. No migration applied, seed committed, privilege grants applied or latency measured. See [milestone-1.md](milestone-1.md) for exact evidence and pending checks.
- Human review: design approval confirmed; implementation/migration/runtime-role template and seed remain available for code review. No implementation review or live database success is inferred.

## 2026-10-15 — Live Milestone 1 validation follow-up

- Human authorization: user configured local Docker MySQL and subsequently the seed password; authorized migrations, tests and persistent seeding without resetting existing data. User also requested correcting the runtime-role database name to salary_management_dev.
- AI actions: verified the development schema was empty, applied the reviewed migration, created a separate new test schema, corrected a MySQL prepared-protocol diagnostic test failure, ran seven passing integration checks and persisted 10,000 employees / 30,700 salary revisions. Verified argon2id credentials without logging secrets, salary/date integrity, migration status and nonempty reseed refusal.
- Files: runtime-role template and environment example now target salary_management_dev; database integration test uses direct exact-result checks instead of unsupported SHOW WARNINGS; README/design/evidence updated. Existing user .gitignore and local .env edits preserved.
- Limits: runtime role not applied; configured connection has administrative grants. Native-client basic conversion had zero warnings, but complete reporting warning handling/aggregate boundaries remain later work. No existing data reset/deleted, no accounts created, no deployment/commit/push. Test schema retained with application tables empty.

Actual follow-up prompts: [004-live-database-validation.md](../prompts/004-live-database-validation.md).

## 2026-10-15 — Documentation and pre-Milestone-2 check pass

- Human request: expand README, record actual Milestone 1 validation, rerun all configured tests/schema/TypeScript checks and identify unimplemented tests. No Milestone 2 features or commits authorized. Actual prompt: [005-pre-milestone-2-validation.md](../prompts/005-pre-milestone-2-validation.md).
- AI contribution: expanded overview/current-vs-planned scope, tech stack, environment-variable reference, local setup and command guide, plus an explicit coverage-gap list. Recorded exact commands/wrapper and captured output in [pre-milestone-2-validation.md](pre-milestone-2-validation.md).
- Actual prior live Milestone 1 results: MySQL 8.0.46; initial migration applied successfully (exit 0); persistent seed committed (exit 0): employees 10,000, salary revisions 30,700, departments 8, designations 24, countries 6, currencies 6, rates 12, HR users 1, sessions 0, inactive employees 400. SQL found zero duplicate employee/date pairs, pre-hire salaries or negative amounts. Nonempty reseed refused with counts unchanged; stored argon2id hash verified. The initial database test run had 6 pass/1 failure from unsupported prepared SHOW WARNINGS, fixed before the successful 7/7 run. Historical “database unavailable” entries above describe the earlier phase and are superseded by these live results.
- Fresh results this pass: npm test — 7/7 tests across 3 files, exit 0; npm run test:db — 7/7 tests in 1 file, exit 0; npm run db:validate, npm run typecheck, npm run build and npm run lint — all exit 0. Total 14 passed, 0 failed, 0 skipped. No frontend test suite exists yet; TypeScript/build success is not UI behavior coverage.
- Data boundaries: no migration or persistent seed was run this pass. Development counts before/after were 10,000 employees and 30,700 salaries. Isolated test fixtures were rolled back; its employee/salary counts ended at zero (auto-increment counters may advance). No existing employee/salary rows were updated/deleted, no reset/drop, no local .env changes and no commit/push/deploy.
- Remaining gaps: runtime role not applied/verified and all unimplemented auth, business API, salary-service, CSV, full analytics, frontend/E2E and performance suites are listed in README/evidence. No claim that those requirements are tested. Human design approval/review is recorded; no new human review of this check pass is inferred.
