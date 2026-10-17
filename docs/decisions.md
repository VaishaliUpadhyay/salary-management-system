# Architecture Decisions — Salary Management System

1. **Database:** MySQL 8.x instead of PostgreSQL due to familiarity and time constraints.
2. **Normalization:** Separate `departments`, `designations`, `countries`, and `employees` tables to avoid duplication and maintain data consistency.
3. **Relationships:** Use foreign keys (`departments → designations → employees → salary_records`) to enforce referential integrity.
4. **Salary History:** Use one append-only `salary_records` table to preserve revisions without overwriting historical data.
5. **Authentication:** Single authenticated HR Manager to keep the MVP secure without complex role management.
6. **Currency Conversion:** Use seeded/cached exchange rates instead of live APIs for deterministic, reliable reporting.
7. **Scope:** Exclude payroll, taxes, payslips, and approval workflows to focus on compensation management and analytics.
8. **Scalability:** Use indexed MySQL queries, server-side pagination, and database aggregation to support 10,000 employees.

## Technical design milestone — 2026-10-15

The original eight product/architecture decisions above remain in force. The following proposals make them implementable; design approval is pending. Sources: requirements, AGENTS.md and the accessible assessment DOCX. No source conflicts were found.

| Decision | Rationale and trade-off | Status |
|---|---|---|
| Prisma-mapped normalized tables with unsigned integer keys and immutable business codes | Separate departments/designations/countries; derive department through designation. Codes provide stable CSV lookup through name changes. No duplicate department/current salary on employees | Proposed |
| Add currencies and sessions tables | Small supported-code catalog enforces currency FKs; persistent opaque sessions support expiry/logout without JWT revocation infrastructure | Proposed |
| Required salary creator attribution | Seed/import/manual revisions all identify the one HR account; this is attribution, not an audit-log feature | Proposed |
| Append-only salaries with unique employee/date and restricted runtime privileges | Database resolves concurrent conflicts. Erroneous historical entries cannot be corrected in the MVP; do not imply a later effective revision erases them | Required rule; enforcement proposed |
| Current salary derived using UTC today and indexed latest-date lookup | Future revisions activate without writes or a scheduler; future-only employees have no current salary | Proposed |
| Analytics counts workforce and salary-covered employees separately | Missing compensation is visible and does not silently become a zero salary; a true zero remains in statistics | Proposed |
| Current-only workforce analytics; reportingDate controls FX only | No assignment/status history exists. Past FX date must not be labeled historical workforce reporting | Proposed |
| USD-reference units-per-USD rates, unique currency/date | One canonical sourced row per currency/date; cross rate is target/source. Independent latest dates can differ and are disclosed | Proposed |
| Direct multiply-then-divide SQL; intermediate DECIMAL(49,24), final DECIMAL(65,24), div_precision_increment=4 | Replaces underspecified 20-place factor arithmetic. MySQL limits/division/aggregates checked in official docs; cast before division. Display factor is informational; runtime edge-case validation remains required | Revised technical design |
| Missing required FX fails the monetary report; identity conversion needs no rate | Prevent misleading partial totals; an unrelated missing currency does not block a report | Required rule; response proposed |
| CSV leaves existing employee master fields unchanged; mismatches rejected | User explicitly selected this policy on 2026-10-15. Name/email/country/designation/hire-date changes happen through employee edit, not import | **Confirmed by user** |
| CSV all-record preflight and one transaction per accepted row | All duplicate employee-code rows rejected; malformed/oversized files cause no writes. Partial success survives retries; `updated` means a salary revision was inserted | Proposed |
| CSV limits: 5 MiB, 10,000 records; synchronous sequential processing | Bounded simplest implementation; hosting timeout/import duration must be measured. No durable jobs or permanent uploads | Proposed |
| Same-date manual salary POST conflicts even if identical; identical CSV row skips | Explicit manual error and deterministic import replay without adding an idempotency subsystem | Proposed |
| Master retirement/re-enable, immutable codes/designation department, no deletion | Preserve references and historical labels; retirement blocks new assignments but allows unchanged existing references | Proposed |
| Nonunique employee email, immutable employeeCode | The requirements make employee identifier unique, not email; shared emails do not accidentally merge people | Proposed |
| Reject pre-hire salaries and new revisions for inactive employees; allow future hire dates/revisions | Explicit user refinement supersedes the original permissive proposal. Preserve all existing history/scheduled revisions. Inactive unchanged CSV replay still skips. Guard hire-date edits against the earliest revision and serialize dependent writes | **Confirmed rules; consistency guard documented** |
| One same-origin Express deployment plus managed MySQL | Simplest cookie/CORS configuration and deployment footprint; frontend remains Vite/React | Proposed |
| Opaque 8-hour sessions, argon2id, random session CSRF token and strict Origin checks | Remove anonymous CSRF/HMAC abstraction. Login is JSON-only with exact Origin validation; authenticated writes also require CSRF token. Keep secure cookies, expiry/logout and rate limiting | Simplified technical design |
| Parameterized report SQL through Prisma | SQL CTE/window aggregation computes median and distributions without loading workforce into application memory; integration tests are essential | Proposed |
| Last-write-wins employee/master edits; deterministic offset pagination | Small single-manager MVP avoids versioning/cursor complexity; multiple tabs and concurrent page changes can still conflict | Proposed |
| Fixed seed/date, insert-only empty-database seeding | Repeatable synthetic dataset without destructive reset or overwriting immutable salaries; demo fixtures age with the calendar | Proposed |
| No extra infrastructure or optional product scope | Keep 2–3 day delivery realistic; preserve exclusions already documented in requirements and AGENTS.md | Confirmed scope |

### Approval and unresolved review

The CSV ambiguity is resolved. No blocking source conflict remains. Review the proposed policies above, especially current-only analytics with selectable FX date, nonunique emails, master retirement, and import limits. Hire-date/inactive rules are now explicitly confirmed, not open choices. Exact dependency versions, hosting/timeout settings, and measured performance are implementation checks, not completed facts. Schema specification is in [database-design.md](database-design.md), endpoint contract in [api-contracts.md](api-contracts.md), and module/security/test plan in [architecture.md](architecture.md).

Implementation must wait for design approval under AGENTS.md. No application code, install, migration, commit, push or deployment was performed in this milestone.


### Final requested adjustments — 2026-10-15

- User explicitly requires salary effectiveDate >= hireDate and prohibits new salary revisions for inactive employees. Future hires and future revisions remain valid, and history remains intact. The related hire-date edit guard prevents violating the same invariant through employee edits; no correction workflow is introduced.
- DECIMAL type declarations were legal, but the prior factor calculation omitted division-scale behavior. The revised direct arithmetic avoids premature factor rounding and documents intermediate types, range bounds for 10,000 salaries, session configuration and numeric-warning handling. Official source verification is complete; no running-MySQL validation is claimed.
- CSV policy/limits/transaction model remain unchanged. Explicitly document committed-prefix/unknown-outcome risk from synchronous timeouts and measure against actual host deadlines. A lower limit or background job is a separate approval decision only if required by measurements.
- Keep direct session/CSRF middleware and remove anonymous CSRF contexts/custom HMAC machinery. Login uses JSON-only plus exact Origin validation; authenticated writes also require a random session CSRF token.
- No new product ambiguity blocks this documentation update. Implementation remains unapproved; exact dependency/hosting choices and performance evidence will be resolved during the authorized implementation/deployment milestones. No application code or database operations were performed.

### Milestone 1 implementation — design approved, 2026-10-15

The user approved the final design and authorized Milestone 1; earlier “proposed”/“implementation unapproved” statuses above describe the prior design stage and are superseded by that approval.

- npm workspaces retain the approved client/server modular-monolith structure. Node 24.x, TypeScript 5.9.3, React 19, Vite 8, Express 5 and Prisma 6.19.3 are pinned in manifests/lockfile. Prisma 6 matches the approved schema/migration workflow; no new database adapter or ORM is introduced.
- Use reviewed generated migration SQL with explicit InnoDB, ASCII binary code/token collations and named CHECK constraints; preserve these manual additions in later migrations. The runtime-role template is operator-managed and does not run automatically.
- Synthetic fixtures use a small fixed-seed generator and integer-cent money arithmetic rather than a large random-data dependency. One transaction/batches of 500 avoids 30,700 individual insert requests; empty-table refusal, explicit database-name acknowledgement and an advisory lock protect against accidental reseeding. This implements the already approved insert-only policy.
- Override deepmerge-ts to 8.0.0 to address the Prisma tooling advisory. Audit reports zero vulnerabilities; schema validation/generation pass with the override. Do not force a Prisma downgrade or change architecture to satisfy audit output.
- Live database tests remain separate and fail setup when missing configuration. No live MySQL was available; SQL constraint/grant behavior and seed execution remain unverified, as recorded in [milestone-1.md](milestone-1.md).

### Live MySQL verification follow-up — 2026-10-15

Development target is salary_management_dev; correct the operator role template and environment example accordingly. MySQL 8.0.46 migration, persistent seed and seven integration tests passed. A separate newly created salary_management_m1_test_20261015 schema isolates rollback-based tests from the populated development database; retain it without reset/drop. Runtime-role grants are still operator-managed and not applied. The configured administrative connection is appropriate only for development migration/seed validation, not future application runtime. MySQL warning diagnostics cannot be prepared through Prisma; record the verified limitation for the later analytics implementation rather than introducing a new driver in this milestone.

### Milestone 3 precision decision — 2026-10-17

The user explicitly approved **“Use Prisma with range checks”** after being told MySQL diagnostic statements cannot be prepared through Prisma. This supersedes the proposed direct numeric-warning inspection requirement for reporting; no driver or schema change is introduced.

- Keep the approved typed multiply-then-divide expression, DECIMAL(65,24) computation values, SQL aggregates and final half-up rounding. Verify `div_precision_increment=4` on the transaction's actual pooled connection, restoring/verifying it when necessary.
- Before SQL conversion/aggregation, check conservative per-currency count × maximum bounds with a local 100-digit decimal context, reject out-of-range bucket casts, and map database numeric errors to `REPORT_NUMERIC_RANGE_EXCEEDED` without partial results. Monetary aggregation remains in MySQL; JavaScript Number is used only for counts/IDs/timing.
- Trade-off: no direct SELECT-warning inspection is claimed. Conservative bounds can reject a safe report when its population is very heterogeneous near the extreme range. Exact finite computation precision and domain/schema constraints remain necessary; real MySQL extrema and rounding tests validate the expressions.
- MySQL restriction reference: [prepared-statement diagnostics restrictions](https://dev.mysql.com/doc/refman/8.0/en/sql-prepared-statements.html). No live FX, cache, new service, historical-workforce reporting or schema/index changes are introduced.
