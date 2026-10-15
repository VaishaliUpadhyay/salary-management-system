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
