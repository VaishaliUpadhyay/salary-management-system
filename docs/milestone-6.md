# Milestone 6 — final QA and submission readiness

**Assessment: NEEDS ATTENTION.** Local functional checks pass: **321 tests, zero failures/skips**, plus lint, typechecks, builds, Prisma validation, migration status and dependency audit. Submission is not fully ready: the unfiltered analytics latency target fails on the current dataset; deployment and video evidence are absent; planned master-data administration routes need a scope decision.

Executed 2026-10-18 against baseline commit `64828dd`, with the QA documentation/setup corrections below uncommitted. Human reports Milestones 1–5 and frontend/API/manual CSV testing complete. That is human-reported evidence, distinct from the AI-executed checks in this report. No deployment, commit or push was performed.

## 1. Requirements compliance

Reviewed `AGENTS.md`, `docs/requirements.md`, architecture, database design, contracts, decisions, AI usage, milestones 1–5, prior validation/error reports, README, source/tests, and the assessment DOCX (extracted with Python's ZIP/XML support). The approved later decisions govern the limited master-route authorization and Prisma numeric-warning workaround; the original contracts are preserved and now explicitly marked where unimplemented.

“Tested” below means implemented and exercised by the checks listed here, not production certification.

| Requirement | Status | Implementation/evidence or gap |
|---|---|---|
| Requirements before coding; goal, persona, scope, exclusions and rationale | Implemented | Requirements/design documents and incremental Git history precede application milestones. |
| F1 employee create/view/edit/search/filter/deactivate | Tested | React forms/details/list; server pagination/AND filters; isolated API tests; no permanent deletion. Employee code unique/immutable; email normalized, not unique by policy. |
| F2 normalized country/department/designation relationships | Tested | Prisma/FKs, department derived through designation; catalog filtering and invalid-assignment tests. |
| F2/master-data API administration | Partially implemented | Three authenticated GET lists work and have tests. Contracted POST/PATCH and single-item GET routes, and administration UI, are absent. Milestone 4 authorized only the lists. Accept/document the reduced scope or separately authorize remaining work before claiming full contract compliance. |
| F3 append-only salary and complete history | Tested | Original amounts/currencies; all/current/historical/future scopes; zero/backdated/future/duplicate dates, pre-hire/inactive rejection, hire-date guard and concurrency tests. |
| F4 employee counts, total, average, median, min/max, distribution, three grouping dimensions | Tested | Database aggregates and filters, dashboard integration, even/odd median and independent fixture results. Employee count is separate from salary coverage. |
| F5 reporting currency, dated/source-labelled FX, original-value preservation | Tested | USD-reference MySQL DECIMAL conversion, no live service; missing/identity/tiny/extreme rates, finite precision/rounding and UTC boundary tests. Reporting date changes FX only. |
| F6 CSV validation, idempotency, partial success, row errors | Tested | Authenticated multipart endpoint, bounded parser, all duplicate-code rows rejected, atomic row writes, replays/conflicts/concurrency/rollback/limits, UI results and safe error CSV. |
| F7 single HR login/logout/session | Tested | Argon2id, hashed opaque sessions, eight-hour expiry, HttpOnly cookies, production cookie flags, CSRF/Origin and limiter tests. |
| F8 deterministic 10,000-person seed and server pagination/aggregation | Tested | Fixture/unit and rollback seed/database tests; seed produces 10,000 employees/30,700 salaries and refuses populated schemas. Existing development dataset was not reseeded. |
| MySQL 8, normalized schema, indexes/FKs/CHECK/unique constraints/transactions | Tested | MySQL 8.0.46 integration and live restricted-runtime checks; current migration up to date. |
| Common API p95 <500 ms on >=10,000 employees | Partially implemented / target failed | Lists and selective report pass. Four unfiltered report cases fail at concurrency 10 on 21,114 employees; full measurements below. |
| Responsive React UI, navigation, loading/empty/errors | Tested within stated limits | Component tests and rendered Chromium assertions/screenshots; no user-facing request IDs or raw backend errors in checked states. |
| Secure inputs, uploads, cookies, authorization, secret hygiene | Tested/reviewed | Security findings below; no confirmed exploitable issue found within review scope. Not an independent penetration test. |
| Deterministic meaningful tests | Tested | 190 fast component/backend tests, 116 isolated MySQL tests, 15 browser tests. Random fixture prefixes isolate rows; assertions use fixed inputs/clock/expected results. |
| Maintainable selected stack / modular monolith | Implemented | Feature modules, shared validation/errors, explicit transaction services, parameterized analytics SQL. No new runtime dependency or architecture introduced in QA. |
| Deliberate AI use / prompt evidence / human review | Implemented | `docs/ai-usage.md`, `prompts/`, decision history; human claims distinguished from AI execution. |
| Incremental repository commits | Implemented | Design, scaffold, backend, analytics, frontend and CSV milestone commits present. Final QA changes remain uncommitted by instruction. |
| Fresh setup instructions | Implemented; partially rehearsed | Clean install/generation/checks/build/tests passed with corrected Node version. New-schema provisioning/migration/persistent seed were not rerun; existing migration status and isolated constraints were verified. |
| Fully functional deployed application / demonstration URL | Missing evidence | No deployment recorded. Same-origin production static hosting/proxy/TLS/UI CSP are not configured. Local API build does not serve Vite assets. |
| Video demonstration | Missing evidence | No video/link supplied or found. |
| Final repository link/submission and clean post-commit status | Pending human action | No commit, push or submission authorized here. Worktree intentionally contains QA changes. |

Excluded payroll/tax/payments, approvals/benefits/equity, multiple roles, historical salary correction, XLSX/live FX and general report export were not introduced. The specifically approved import-error download is not a compensation export feature.

## 2. Commands and actual automated results

Commands ran from the repository root. Output was captured under `/tmp/m6-*.log`; numeric results below are actual executions, not copied forward from prior milestones.

| Command | Actual result | Exit |
|---|---|---:|
| `npm test` | Client: 4 files / 93 tests passed; server: 9 files / 97 tests passed | 0 |
| `npm run test:db` | 3 files / 116 tests passed on guarded isolated MySQL schema | 0 |
| `npm run test:browser` | 15 Chromium tests passed | 0 |
| `npm run lint` | No warnings/errors | 0 |
| `npm run typecheck` | Both workspaces passed | 0 |
| `npm run build` | Vite production build and backend TypeScript compilation passed | 0 |
| `npm run db:validate` | Prisma schema valid | 0 |
| `npm run db:status` | One migration found; database up to date | 0 |
| `npm exec -w server -- tsx prisma/operations/verify-runtime.ts` (before and after) | Grants, credential separation, counts/integrity and empty test schema verified | 0 |
| `npm audit --json` | 0 vulnerabilities (info/low/moderate/high/critical all 0) | 0 |
| `git diff --check` | No whitespace errors | 0 |
| `PERF_DATABASE_NAME=salary_management_dev PERF_OUTPUT_FILE=../../docs/performance/milestone-6-analytics.json npm run bench:analytics` | 7,000 measured responses, zero errors; preservation PASS; latency failures below | 0 |
| `npm run bench:imports` | Six cases matched expected counts; fixture cleanup verified | 0 |

**321 distinct configured tests passed, none failed or skipped.** The clean-install rerun below repeats 190 of these; it does not increase the distinct test count. Benchmark exit 0 verifies successful requests/preservation, **not** satisfaction of the latency target. Browser output contains harmless `NO_COLOR`/`FORCE_COLOR` warnings; no test failure is hidden by them.

API integration covers login/logout/rotation/expiry, cookies and denied requests, employee initial-salary atomicity, lookup endpoints, filters/retired references, deactivation, salary classifications/dates/races, FX calculations, and actual multipart import rollback/limits/conflicts. Frontend tests cover session restoration/logout, protected routing, field validation, CRUD interactions, loading/empty/failure states, dashboard controls, import results and downloads. They complement, rather than replace, the user's reported manual workflows.

### Independent financial verification

The real-MySQL controlled fixture uses original current salaries USD 0, USD 100, EUR 100 and INR 300, with units-per-USD EUR 2 and INR 3. Expected USD amounts are manually specified as **0, 100, 50, 100**, not derived using the production converter. Expected total **250.00**, mean **62.50**, even median **75.00**, min **0.00**, max **100.00** match responses. Seven active employees comprise four current salaries plus three missing-current cases (future hire, future-only revision and no salary). History/future revisions do not double-count. Including an inactive USD 50 employee yields total **300.00**, average **60.00**, odd median **50.00**. All these assertions passed.

Additional passing MySQL tests verify EUR reporting, earlier FX dates without historical salary selection, half-up rounding after aggregation, unrounded bucket membership, repeating ratios, tiny/extreme rates, unsafe-bound rejection, division precision on the actual pooled connection and UTC midnight. No JavaScript floating-point monetary aggregation or original-amount rewriting is used. Direct SELECT-warning inspection remains unavailable through Prisma; the approved conservative range checks remain the trade-off.

## 3. Performance measurements

### Analytics and lists

Evidence: [raw analytics results and EXPLAIN ANALYZE](performance/milestone-6-analytics.json). Node **24.20.0**, MySQL **8.0.46**, macOS arm64 Apple M1, 8 logical CPUs, 8 GiB host memory. Docker reports 8 CPUs / 4,109,344,768 bytes available to its VM; container-specific CPU/memory limits are unset. API and database are local; no TLS/proxy/network deployment overhead. Background host activity is not controlled. No other QA tests/builds were deliberately run concurrently with benchmarks.

Existing development data: **21,114 employees, 41,816 salary records**, including seeded and human/CSV-test records; **401 inactive**, 20,713 active. This exceeds the minimum 10,000 but is not an isolated exactly-10,000 seeded cohort. Do not attribute the difference from earlier milestones solely to code regression: population, distribution and machine load differ.

Each case: one first request, 20 sequential warmups, **1,000 measured requests at concurrency 10**. Timing includes authenticated local HTTP response/body reading; p95 is the nearest-rank 950th sorted observation. The first request is recorded in JSON but is not a cold OS/database-cache experiment. All measured requests returned 200; no errors.

| Case | p50 ms | p95 ms | Maximum ms | Strict p95 <500 ms |
|---|---:|---:|---:|---|
| summary-usd | 669.11 | 999.15 | 1568.81 | FAIL |
| country-eur | 789.75 | 1027.20 | 1382.64 | FAIL |
| department-usd | 831.56 | 1066.08 | 1374.88 | FAIL |
| designation-inr | 914.13 | 1453.67 | 2412.60 | FAIL |
| combined-filters | 36.93 | 114.32 | 405.92 | PASS |
| employee-late-page | 82.64 | 128.37 | 178.39 | PASS |
| employee-contains | 77.33 | 139.23 | 524.87 | PASS |

The strict target **fails** for all four unfiltered analytics cases. Filtered reporting and both lists pass. No schema/index/cache or business-rule changes were made to hide the failure.

The department `EXPLAIN ANALYZE` completed at approximately **587 ms**, materializing 20,713 converted rows, expanding to 41,426 overall/group rows, sorting/windowing for median and aggregating through temporary tables. It uses `employees_designation_id_is_active_id_idx` and the unique `salary_records_employee_id_effective_date_key`; latest effective salary and final salary retrieval are indexed. Coverage and final aggregation each build the current population. The plan points to repeated population work, nested lookups and DECIMAL/window materialization, rather than an absent primary/FK index alone.

Next optimization investigation: compare safe population/query rewrites and actual connection-pool/concurrency behavior while retaining exact medians and range checks. A covering salary index `(employee_id,effective_date,amount,currency_code)` could reduce table lookups, but needs a measured comparison and schema approval; it cannot remove the computed-value median sort. Contains search inherently limits B-tree name-index usefulness; late offset pages also perform skipped-row work. No speculative index, cache or approximate statistic was added.

### CSV imports

Evidence: [raw CSV measurements](performance/milestone-6-imports.json). Same local machine/MySQL; concurrency 1, authenticated multipart HTTP through Supertest, complete parsing/transactions/response included. Each size was measured once for creation and once for identical replay; these are observed elapsed times, **not p95 estimates**. Rows include two currencies, zero salaries and future hires/revisions.

Counts below are **created / updated-salary / skipped / rejected**. Every response was HTTP 200.

| Rows | Mode | Time ms | Counts | Sampled peak RSS MiB | SQL statements |
|---|---|---:|---|---:|---:|
| 100 | create | 511.61 | 100 / 0 / 0 / 0 | 253.30 | 806 |
| 100 | replay | 283.11 | 0 / 0 / 100 / 0 | 258.63 | 706 |
| 1,000 | create | 5430.91 | 1000 / 0 / 0 / 0 | 269.92 | 8,006 |
| 1,000 | replay | 2016.80 | 0 / 0 / 1000 / 0 | 191.73 | 7,006 |
| 10,000 | create | 36944.76 | 10000 / 0 / 0 / 0 | 229.73 | 80,009 |
| 10,000 | replay | 22332.98 | 0 / 0 / 10000 / 0 | 245.78 | 70,010 |

All 11,100 created fixture employees and 11,100 salaries were verified; replay created none. Cleanup removed only harness-owned isolated fixtures and verified all test application tables empty. Development records were not used for import writes.

RSS samples every 10 ms include the Node API, generated request buffers, Prisma/native overhead and test harness, excluding MySQL. Peak across cases was **269.92 MiB**; GC causes baseline/peak variation, so this is not an exact per-request allocation or leak bound. Largest generated CSV was 1,444,268 bytes; the 5 MiB boundary is tested separately. Simultaneous upload memory/load was not benchmarked.

Catalog references load once per import; approximately eight SQL statements per created row and seven per replay reflect the approved row transactions/locks/lookups. The serial round trips are a significant cost. The **36.945-second** 10,000-row creation exceeds a common 30-second proxy deadline; no deployed proxy deadline has been verified. A timeout may follow committed rows and lose results. Retain explicit reconciliation/idempotent replay; choose deployment deadlines deliberately. Lowering limits or adding background jobs needs separate approval.

## 4. Security and database preservation

No confirmed exploitable vulnerability was found in the inspected implementation; this is a scoped source/test/dependency review, not a penetration-test guarantee.

| Area | Reviewed/verified behavior |
|---|---|
| Authentication | Argon2id password hashing; random opaque tokens, only SHA-256 token hashes persisted; eight-hour server-side expiry, rotation/logout revocation. No session/password browser storage. |
| Cookies / Origin / CSRF | HttpOnly/SameSite=Lax; Secure `__Host-` production settings tested; exact Origin and JSON-only login; session CSRF required on authenticated JSON and multipart mutations. No wildcard credentialed CORS. |
| Authorization / rate limiting | Data routes require valid session; five failed login attempts per IP/window with concurrent reservation. Limiter is process-local; deployment proxy IP handling remains pending. |
| Input / SQL | Zod validation, fixed allowlisted SQL fragments and bound values; salary invariants under row locks; database uniqueness/FKs/CHECKs final authority. |
| CSV | Auth/security precedes bounded multipart parsing; 5 MiB and 10,000-row limits, UTF-8/malformed syntax/headers checked before writes; no persistent upload storage. Spreadsheet formula prefixes neutralized in generated error reports; quotes escaped. |
| Errors / logging | Safe structured codes and request tracing retained server-side; frontend maps codes without displaying request IDs/raw SQL/stack text. Logs omit original error/input/credentials and use safe metadata. Per-request duration/access logging is not implemented; production observability remains limited. |
| Database credentials | Distinct migration/runtime users on the intended schema. Runtime salary UPDATE and DELETE denied with MySQL **1142**; development checks use non-mutating EXPLAIN, isolated tests also exercise denied statements. Startup fails if these privileges exist. |
| Dependencies / repository | `npm audit` 0 vulnerabilities; tracked-file secret-pattern scan found none; no tracked non-example dotenv, dependency/build/report/private backup artifacts. No unnecessary dependency added. |

Before and after read-only SQL counts from `verify-runtime.ts`:

| Table/state | Before | After |
|---|---:|---:|
| Employees | 21,114 | 21,114 |
| Salary records | 41,816 | 41,816 |
| Departments / designations | 8 / 24 | 8 / 24 |
| Countries / currencies / exchange rates | 6 / 6 / 12 | 6 / 6 / 12 |
| HR users / sessions | 1 / 2 | 1 / 2 |
| Inactive employees | 401 | 401 |
| Duplicate employee/effective-date pairs | 0 | 0 |
| Pre-hire / negative salaries | 0 / 0 | 0 / 0 |

Analytics additionally compared SHA-256 hashes of **all persisted employee, salary and exchange-rate fields** before/after: PASS. Its own temporary authentication session was created and removed; no existing session was removed. All isolated test application tables are empty after completion. No employee/salary changes, seed, migration, reset, truncate or development cleanup was executed. The earlier proposed cleanup remains unapproved.

Secret checks cover current tracked text with common token/private-key/connection-string patterns and historical non-example dotenv filenames, not a forensic guarantee that every historical blob is secret-free. Actual `.env`, `node_modules`, `dist`, browser artifacts and `.local-db-cleanup/` are ignored. SQL migration files are intentional source, not database dumps.

## 5. Frontend and workflow quality

Fresh Chromium runs cover normal dashboard/list responsive behavior, dialog focus trapping/Escape/focus restoration, original-currency details and CSV download, plus error workflows at **375, 768 and 1440 px**. Other existing responsive cases use 320/390 px. Checks assert no page horizontal overflow, technical identifiers/troubleshooting controls, duplicate alerts or detached field-error geometry. Components retain labels, `aria-invalid`, `aria-describedby`, alert/status semantics and native keyboard controls.

Fresh rendered screenshots were actually inspected: mobile login and long CSV errors, tablet multi-field employee creation, desktop missing-FX state. No overlap or page overflow was observed. The existing CSV header example scrolls within its own area; long row messages wrap vertically. Browser tests also exercise directory/detail/edit/salary/history/range errors across all three requested sizes. Screenshot files are local `/tmp/m6-errors-*.png`, not committed artifacts.

Limitations: no native screen-reader audit, formal WCAG/contrast or cumulative-layout-shift metric, Safari/Firefox/real-device test, or production TLS browser check. The browser suite mocks APIs; real backend integration uses MySQL separately. Full live browser-to-MySQL mutation automation is not implemented. Human manual workflows are user-confirmed, not newly claimed as AI-performed production testing.

## 6. Fresh setup verification and fixes

A tracked-source copy was created in an isolated temporary directory with **zero real environment files/credentials copied**. Initial `npm ci` unexpectedly used Node **24.10.0 / npm 11.6.0** outside the repository and failed **exit 1, EBADENGINE**: locked jsdom-related packages require Node >=24.15 within the 24.x line. The old declared >=24.0 range was too broad.

Confirmed setup correction: root manifest/lock metadata now require **>=24.15.0 <25**, and `.nvmrc` pins the validated **24.20.0**. No dependency version or application behavior changed. Retrying with Node **24.20.0 / npm 11.19.0** succeeded: `npm ci`, **exit 0**, 446 packages installed, zero vulnerabilities. The local user npm configuration produced an allow-scripts precedence warning; project `allowScripts` remained effective, with no security bypass added.

In that clean copy, with dummy unconnected `DATABASE_URL`/`MIGRATION_DATABASE_URL` values, these commands all exited **0**:

```bash
npm run db:generate
npm run db:validate
npm run typecheck
npm run build
npm test # 93 frontend + 97 backend tests passed again
```

The install retry used `PATH=/Users/vaishaliupadhyay/.nvm/versions/node/v24.20.0/bin:$PATH npm ci`; the subsequent process used the same selected Node path. Logs: `/tmp/m6-clean-install.log` (initial failure), `/tmp/m6-clean-install-retry.log`, `/tmp/m6-clean-{generate,schema,typecheck,build,tests}.log`. No real database connection was supplied to this clean-copy rehearsal.

[Fresh setup](setup.md) now explicitly documents schema/owner creation, separate test migration, restricted roles/logins/default roles, environment fields, seed refusal, and commands. Existing schema status/constraints/rollback seed tests pass. **A new MySQL installation plus owner provisioning/migration/persistent seed was not rehearsed from scratch during QA**, to avoid silently creating or modifying database infrastructure. Production hosting is also not verified. Do not conflate successful clean source install/build with a deployed-system test.

## 7. Changes and final handoff

- `README.md`, `client/.env.example`: current completion status, accurate counts/benchmarks/limitations, setup link and current frontend environment guidance.
- `docs/setup.md`: fresh local database/environment/migration/role/seed/test instructions.
- `docs/milestone-6.md`, `docs/ai-usage.md`, `prompts/012-milestone-6-qa.md`: QA evidence, human/AI attribution and actual request.
- `docs/api-contracts.md`, `docs/architecture.md`, `docs/database-design.md`: implementation-status notes, without changing approved contracts/schema/architecture.
- `docs/performance/milestone-6-{analytics,imports}.json`: fresh measurements and analytics execution plan.
- `.nvmrc`, `package.json`, `package-lock.json`: corrected Node compatibility metadata only.
- `server/benchmarks/analytics.ts`: optional `PERF_OUTPUT_FILE` so new measurements do not overwrite historical Milestone 3 evidence.

No frontend/backend business feature or database schema changed. Existing runtime dependencies remain unchanged. Initial Git status was clean; final changes are deliberately uncommitted, with no staged secrets or generated artifacts. A “clean after final commit” result cannot be claimed because no commit was authorized.

Before submission: resolve/document the analytics target miss; decide the master-data contract scope; obtain deployment approval and verify real HTTPS/session/proxy/import deadlines; supply a demonstration URL and video; review/stage the QA changes and commit explicitly. No additional feature or deployment was started.

Suggested commit: `chore: complete final QA audit and correct local setup requirements`.
