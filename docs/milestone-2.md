# Milestone 2 — Employee and salary backend APIs

Status: **complete, human-reviewed and manually tested**, confirmed by the user on 2026-10-17. Recorded automated execution date: 2026-10-15.

Human authorization: implement the approved Milestone 2 scope; preserve seeded development rows, use the existing isolated test database, do not commit/push/deploy. The AI implementation introduced no schema, migration, dependency, frontend feature or approved architecture change.

## Implementation

- Direct Express routers/services for authentication, employees and salary revisions; Zod rejects unknown request fields, invalid IDs/dates/decimal amounts and unsupported references. Errors share the contract envelope and request ID without exposing SQL, salaries or credentials.
- Employee creation and initial salary are atomic. Filters/search/sort/count/offset/limit run in MySQL. One batched query returns current/next-future salary summaries for the employee page; there is no per-employee salary query. Existing indexes and the unique employee/effective-date key are unchanged.
- Read operations use repeatable-read transactions for consistent count/page/classification. Writes use read-committed transactions and lock the employee row with `FOR UPDATE` before salary creation, hire-date edits or deactivation. A competing operation sees the committed employee state after obtaining the lock. Tests accept either valid serial ordering, not a timing-dependent winner.
- Salary revisions remain append-only. Active employees may receive future or backdated revisions, never pre-hire or duplicate-date revisions. Hire-date edits cannot invalidate the earliest salary. Deactivation preserves history; new revisions are rejected. Future-only employees have no invented current salary. Original currencies and decimal amounts remain unchanged.
- Authentication uses existing argon2 hashes, 256-bit opaque tokens (only SHA-256 token hashes stored), session-bound CSRF, an eight-hour expiry, exact Origin and JSON checks, HttpOnly/Lax cookies, and Secure `__Host-` cookies with HTTPS in production. No new application roles, signup or authentication framework.
- Five failed logins per IP per 15 minutes; pending verifications reserve slots to prevent concurrent bypass. No trust of forwarded IP headers. Sessions and sensitive responses are not cached.

Implemented routes, all under `/api/v1`:

| Method | Route |
|---|---|
| POST | `/auth/login`, `/auth/logout` |
| GET | `/auth/session`, `/auth/csrf` |
| GET, POST | `/employees` |
| GET, PATCH | `/employees/:id` |
| POST | `/employees/:id/deactivate` |
| GET, POST | `/employees/:id/salary-records` |
| GET | `/employees/:id/salary-records/:salaryId` |

All employee/salary routes require authentication; mutations additionally require Origin, JSON and CSRF. The contract’s minimal `/health` is public. Salary history supports `scope=all|current|historical|future` and pagination; complete history is accessible across pages.

## Files

- Modified: `server/src/app.ts`, `server/src/index.ts`, `server/src/lib/env.ts`, `server/test/app.test.ts`, `server/.env.example`, `README.md`, `docs/ai-usage.md`.
- Added: `server/src/lib/{database,errors,runtime-security,validation}.ts`, `server/src/types/express.d.ts`, `server/src/modules/auth/routes.ts`, `server/src/modules/employees/{routes,schemas,service}.ts`, `server/src/modules/salaries/{schemas,service}.ts`.
- Added: `server/test/api.db.test.ts`, `server/test/validation.test.ts`, `server/prisma/operations/provision-local-runtime.mjs`, `server/prisma/operations/verify-runtime.ts`, this evidence file and `prompts/006-milestone-2.md`.
- Ignored local `server/.env`: runtime/test-runtime account credentials configured, migration owner URL aligned to the development schema, file mode set to 0600. No secrets appear in committed templates or output.

## Actual commands and results

The following results are from the available 2026-10-15 execution logs, not a new run on 2026-10-17. Commands ran from the repository root. Shell `&&` chains below proceeded only after the previous command succeeded. Database/network/listener commands required execution outside the local sandbox. No migration deployment or seeding command was run this milestone.

| Command | Final result | Exit code |
|---|---|---:|
| `node server/prisma/operations/provision-local-runtime.mjs` | Fresh development/test runtime accounts and scoped roles created; counts unchanged | 0 |
| `npm test` | 4 files; 26 passed, 0 failed/skipped | 0 |
| `npm run test:db` | 2 files; 45 passed, 0 failed/skipped | 0 |
| `npm exec -w server -- tsx prisma/operations/verify-runtime.ts` | Runtime grants, count/integrity and test-cleanup checks below | 0 |
| `npm run db:status` | One migration found; schema up to date | 0 |
| `npm run typecheck` | Client and server TypeScript checks passed | 0 |
| `npm run lint` | ESLint, zero warnings | 0 |
| `npm run build` | Client Vite/TypeScript and backend compilation passed | 0 |
| `npm run db:validate` | Prisma schema valid | 0 |
| `npm run start -w server` | Built server passed startup permission checks and listened on port 3000; deliberately stopped with Ctrl-C after smoke checks | 130 (intentional shutdown) |
| `curl --silent --show-error --include http://127.0.0.1:3000/api/v1/health` | HTTP 200, `{"status":"ok"}` | 0 |
| `curl --silent --show-error --include http://127.0.0.1:3000/api/v1/employees` | HTTP 401, `UNAUTHENTICATED`, consistent error envelope/request ID | 0 |

Final validation chains:

```bash
npm test && npm run test:db && npm exec -w server -- tsx prisma/operations/verify-runtime.ts && npm run db:status
npm run typecheck && npm run lint && npm run build && npm run db:validate
```

Both chains exited 0. Final `git diff --check`, unchanged-schema/migration/architecture/dependency diff checks and local documentation-link checks also passed (exit 0). Captured test summaries:

```text
Test Files  4 passed (4)
     Tests  26 passed (26)
  Duration  794ms

Test Files  2 passed (2)
     Tests  45 passed (45)
  Duration  4.47s
```

**Total: 71 passing tests.** Database tests comprise 38 new API/security tests and 7 existing schema/seed checks. Coverage includes every protected endpoint without a session, login/session/logout, expiry, production cookies, CSRF/Origin, concurrent rate limiting, employee create/detail/patch/deactivate, retired references, literal search and filters/pagination, history scopes, original currency preservation, zero/future salaries, duplicate/pre-hire/inactive rejection, hire-date guards, UTC rollover, three concurrent modification scenarios and actual restricted-user permissions.

Intermediate failures were investigated and fixed, not hidden: initial typechecks exited 2 for the changed app factory/test typings; initial lint exited 1 for an unused Express fourth argument and missing error cause. The first unit run had 25 pass/1 fail (invalid URL refinement threw before safe validation); fixed with `URL.canParse`. The first integration run had 41 pass/3 fail: Prisma raw unsigned IDs returned as bigint, so page salary summaries missed numeric map keys. Explicit safe uint32-to-number conversion fixed them; the next run passed 44/44, and adding retired-reference coverage produced the final 45/45. The first sandboxed provisioning attempt exited 1 without provisioning; the authorized external-sandbox retry succeeded. These are development failures, not outstanding failed checks.

## Database security and preservation evidence

The approved `runtime-role.sql` was applied for development, plus an equivalent role scoped to `salary_management_m1_test_20261015`. The provisioning helper refuses existing accounts rather than resetting passwords or replacing accounts. Database roles do not introduce additional application roles. Runtime account passwords were generated locally and sent to MySQL over stdin, never command arguments or logged output.

Read-only verification output from 2026-10-15, **before subsequent human manual testing**:

```text
Runtime identity [{"db":"salary_management_dev","account":"salary_runtime_app@%","activeRole":"`salary_runtime`@`%`","mysqlVersion":"8.0.46"}]
Salary UPDATE / DELETE: both denied (MySQL 1142; read-only EXPLAIN checks)
Credential separation {"distinctAccounts":true,"sameDatabase":true}
Development counts [{"employees":10000,"salaries":30700,"departments":8,"designations":24,"countries":6,"currencies":6,"rates":12,"users":1,"sessions":0,"inactive":400}]
Development integrity [{"duplicateDates":0,"preHire":0,"negativeSalaries":0}]
Isolated test counts [{"employees":0,"salaries":0,"departments":0,"designations":0,"countries":0,"currencies":0,"rates":0,"users":0,"sessions":0,"inactive":0}]
```

`SHOW GRANTS` returned USAGE globally, the approved table grants and the runtime role: salary records SELECT/INSERT only; employees/departments/designations/countries SELECT/INSERT/UPDATE; currencies/exchange_rates/users SELECT; sessions SELECT/INSERT/DELETE. No broad global or schema privileges were present. Startup tests also prove an owner account is rejected. Runtime uses `DATABASE_URL`; Prisma CLI uses the unchanged schema `directUrl = env("MIGRATION_DATABASE_URL")`. A real built-server startup exercised this separation successfully.

Development checks use SELECT and:

```sql
EXPLAIN UPDATE salary_records SET amount = amount WHERE 1 = 0;
EXPLAIN DELETE FROM salary_records WHERE 1 = 0;
```

Both return MySQL 1142. In the isolated schema, tests additionally execute the equivalent UPDATE/DELETE with `WHERE 1=0`, asserting MySQL 1142. API create/patch/deactivate tests prove the intended grants allow normal operations.

During the AI implementation/validation phase only: exact count/integrity SQL is retained in `server/prisma/operations/verify-runtime.ts`. Development employee/salary counts matched before and after provisioning and after tests. No development API login, business mutation, reseed, reset, truncate, table drop or schema migration was performed. Only MySQL security metadata and ignored credential configuration were changed. Test fixtures alone were created/removed in the isolated schema; its auto-increment counters may advance.

## Human review and manual testing — confirmed 2026-10-17

The user confirmed that Milestone 2 implementation, human review and manual testing are complete, and that automated tests, lint, typechecks and builds passed. This is human-reported verification, distinct from the AI-executed automated checks above. No additional command transcripts or scenario-by-scenario manual results were supplied; the 71-test count and exit codes above remain attributed to the actual available execution logs.

Manual testing added **2 employees and 3 salary records** to the development database. Relative to the previously queried baseline of 10,000 employees and 30,700 salaries, those additions imply 10,002 employees and 30,703 salaries if there were no other changes. These are derived totals, not fresh SQL measurements. The earlier zero-session and integrity results are historical snapshots and are not claimed as current after manual testing. No database query or mutation was performed during this documentation review.

## Pre-commit Git review — 2026-10-17

- `git status` / `git status --short`: branch `main`, nothing staged. Reviewed modified files and the full untracked-file list with `git ls-files --others --exclude-standard`; new Milestone 2 source, tests, operation scripts and documentation still need deliberate staging.
- `git ls-files` and `git diff --cached --stat`: no tracked or staged real `.env`, dependency directories, generated builds or database dumps. `server/.env.example` and `client/.env.example` are intentional templates. SQL migration and role scripts are source, not dumps.
- `git check-ignore -v server/.env node_modules client/dist server/dist` confirms those local artifacts are ignored. A targeted secret-pattern scan of tracked/unignored text found no non-placeholder MySQL URL passwords, private-key blocks or GitHub tokens; this is a limited check, not a guarantee against every secret format.
- Additional existing changes in `client/index.html`, `client/src/main.tsx`, `server/prisma/seed-data.ts` and `server/prisma/seed.ts` are formatting changes outside the backend feature scope. Leave them out of a focused Milestone 2 commit or stage them separately intentionally; this review did not edit or revert them.
- No current unwanted untracked artifact was found. Keep local credentials, builds, `node_modules`, dumps and manual-test cookie/token files out of Git. Dump files are not covered by a dedicated ignore rule; do not add them if created later. No ignore rule was changed in this documentation-only pass.

## Remaining limitations and pending work

- No frontend behavior/E2E tests, CSV import, analytics/currency reporting or p95 latency/load measurements yet. No performance target is claimed. MySQL contains search can scan matching rows; pagination bounds returned data but not all search work.
- The rate limiter is process-local, resets on restart and shares the reverse proxy's IP until an explicit trusted-proxy deployment configuration is reviewed. This is a single-process MVP; distributed limits are not implemented.
- Production cookie behavior is tested via Supertest, not an actual TLS/browser deployment. Deployment, secret distribution and connection pool sizing remain future work. Local runtime accounts use `%` host matching for Docker connectivity and should be scoped for deployment.
- Expired sessions are cleaned at successful login; no background cleanup scheduler. No history correction/reactivation endpoint is added. Database administrators can still modify history; runtime accounts cannot.
- Cross-table hire-date/active-state rules are enforced by the transactional application path, not new triggers/schema constraints. Future writers (including CSV) must use the same employee-lock convention.
- Tests deliberately require the existing named, migrated, empty test schema. Targeted cleanup is not crash recovery; if a process is killed, inspect leftover fixtures before rerunning. No automatic reset is provided.
- Unexpected errors return safe messages without raw error logging; production observability remains a deployment task.

Human implementation review is complete as reported above. Documentation and Git hygiene are ready for selective staging; decide separately whether to include the existing formatting-only changes. No unresolved product ambiguity required a design change. Suggested commit: `feat: implement authenticated employee and append-only salary APIs`.
