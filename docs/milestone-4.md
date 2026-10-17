# Milestone 4 — HR frontend and API integration

Implementation date: 2026-10-17. On 2026-10-18 the user confirmed Milestone 4 frontend implementation and manual testing are complete. Pre-commit validation passed as recorded below. CSV import remains Milestone 5.

## Implemented screens

- HR login, protected navigation, session bootstrap after refresh, logout and expired-session handling. HttpOnly cookies remain server-owned; fetch includes credentials, CSRF stays in memory, mutations send `X-CSRF-Token`. No passwords or authentication tokens are persisted in browser storage. Local development uses the existing same-origin Vite proxy.
- Compensation dashboard: active/eligible employees, total annual base salary, average, median, minimum and maximum; Recharts distribution with exact tabular counts; country, department and designation breakdown tabs. Currency, FX date, organizational filters, inactive inclusion and distribution boundaries use the backend report. Salary coverage is distinguished from workforce count, including future hires without current pay. FX dates/sources and illustrative-rate limitations are visible. Missing FX and numeric-range errors suppress monetary results.
- Employee directory: database pagination, name/code/email search, organization/status filters, sorting and profile links. Query state lives in the URL and survives return navigation/refresh. Inactive employees are excluded by default.
- Employee profile: atomic create with initial salary, master-field editing, confirmation before deactivation, current salary and next future revision. Retirement rules constrain assignment choices; backend errors remain authoritative.
- Salary history: paginated all/current/historical/future scopes and append-only revision form. Original currency/amount remains visible. Pre-hire dates and invalid amounts are rejected locally, future revisions are supported, and inactive profiles cannot add revisions. No salary edit/delete or employee permanent-delete controls exist.
- Shared loading, empty, success, API validation/error and explicit retry states. Read requests are aborted when superseded; stale filtered results are hidden. Mutations are never automatically retried after an uncertain network failure.

## Organization and APIs

Feature folders under `client/src/features/{auth,analytics,employees,salaries}` use typed fetch contracts in `client/src/lib`. React context handles authentication; feature state is local and filters use hash URLs. Hash navigation avoids a router dependency and production route-rewrite requirements. The dashboard/chart bundle is lazy-loaded. Locally owned shadcn-style Button/Dialog components use CVA and Radix primitives, with Tailwind and shared CSS. No state-management framework was added.

Integrated API paths, all under `/api/v1`:

| Method | Paths |
|---|---|
| POST | `/auth/login`, `/auth/logout` |
| GET | `/auth/session` (includes the existing CSRF token) |
| GET | `/analytics/compensation`, `/currencies` |
| GET | `/countries`, `/departments`, `/designations` |
| GET / POST | `/employees` |
| GET / PATCH | `/employees/:id` |
| POST | `/employees/:id/deactivate` |
| GET / POST | `/employees/:id/salary-records` |

**Explicitly approved backend addition:** the user answered “Yes, add the three read endpoints” for missing country/department/designation lists. They are authenticated, paginated, sorted by name/id, support active/inactive/all status and designation department filtering, and use a repeatable-read transaction for count/page consistency. No master-data writes, schema change or business-rule change was made.

Monetary displays group the API's decimal strings directly, without floating-point arithmetic. Charts plot employee counts; no client-side conversion or financial aggregation occurs. Existing backend DECIMAL calculation tests remain the financial authority.

## Validation evidence

Commands were executed in this repository on macOS, Node 24/npm 11, local MySQL 8.0.46. Final results are recorded below; preliminary failures and fixes are distinguished from final results.

| Command | Result | Exit |
|---|---|---:|
| `npm test` | 32 frontend + 32 backend passed; 0 failed/skipped | 0 |
| `npm run test:db` | 86 passed, 0 failed/skipped, 3 files | 0 |
| `npm run test:browser` | 6 passed, 0 failed/skipped; 4.3 seconds | 0 |
| `npm run lint` | Passed | 0 |
| `npm run typecheck` | Passed | 0 |
| `npm run build` | Passed | 0 |
| `npm run db:validate` | Prisma schema valid | 0 |
| `npm exec -w server -- tsx prisma/operations/verify-runtime.ts` | Read-only permissions, counts, invariants and test cleanup passed | 0 |

**Total: 156 tests passed, zero failed/skipped in final runs** (32 frontend, 32 backend, 86 database, 6 browser). Client and backend TypeScript and production builds both passed. Client output: entry 325.10 kB / 102.59 kB gzip; lazy dashboard 364.70 kB / 105.60 kB gzip; CSS 17.66 kB / 5.17 kB gzip. These are build sizes, not runtime latency measurements.

Frontend tests use deterministic mocked fetch responses. Coverage includes login success/failure, protected routing, session restoration/logout/401 expiry, CSRF/credentials, list search/filter/pagination, create/edit/deactivate, original-currency history and scope, pre-hire rejection, future revision submission, duplicate-date API errors, reporting currency/group changes, missing FX/numeric range, loading/empty states and error recovery. Real HTTP/Prisma integration is exercised by the backend database suites, including the three new catalogs. Browser tests mock every API request; they cannot mutate development data.

Chromium checks cover real Recharts rendering and dashboard/directory layouts at 1440, 768, 390 and 320 px, mobile employee details, labeled form controls, initial dialog focus, Tab focus trapping, Escape dismissal and focus restoration. Tables scroll within their containers. Desktop/mobile dashboard screenshots were inspected by the AI. This is not a full screen-reader or WCAG audit.

Initial frontend pass: 18 passed/9 failed due to a test mock leaking into later cases; corrected. Early typecheck found lookup delegate-union typing and test-query option errors; corrected. Initial lint found two unused conditional expressions; corrected. Sandbox runs could not open HTTP listeners or reach MySQL; the database run skipped all 86 cases, and two backend HTTP tests failed with EPERM. Authorized reruns outside that restriction passed. First Chromium run passed 4/6 and detected mobile grid overflow; fixed and rerun. These failed attempts are not counted as successful validation.

Dependency setup commands:

```sh
npm install -w client --save-exact @radix-ui/react-dialog class-variance-authority
npm install -w client --save-dev --save-exact vitest@5.0.4 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @playwright/test
npm exec -w client -- playwright install chromium
```

Installs completed with exit 0; npm reported zero vulnerabilities at installation. The initial sandbox dependency attempt failed with ENOTFOUND and was retried with network access. Browser binaries and generated artifacts are not tracked. Formatting used `npm exec --yes --package=prettier@3.6.2 -- prettier --write client/src client/test client/e2e client/playwright.config.ts client/vitest.config.ts server/src/modules/master-data/routes.ts` (exit 0 after an initial sandbox ENOTFOUND); it added no project dependency.

## Initial implementation database safety and read-only results (2026-10-17)

No migration, seed, reset or development mutation was run. Tests used only `salary_management_m1_test_20261015`, with existing nonempty-schema safeguards and cleanup limited to suite-owned fixtures.

Read-only verification output:

```text
MySQL: 8.0.46
Salary UPDATE / DELETE: both denied (MySQL 1142; read-only EXPLAIN checks)
Credential separation: distinctAccounts=true, sameDatabase=true
Development: employees=10002, salaries=30703, departments=8, designations=24,
  countries=6, currencies=6, rates=12, users=1, sessions=1, inactive=401
Development integrity: duplicateDates=0, preHire=0, negativeSalaries=0
Isolated test counts: all application tables=0
```

The two employees and three salaries previously added through human manual testing remain present. No development login/session was created by these checks.

## Limitations and review

- The user confirmed frontend manual testing is complete. No scenario-by-scenario manual transcript was supplied, so individual human assertions are not invented. AI browser tests and real isolated-backend tests are separately documented.
- Browser automation covers Chromium with mocked HTTP. No full browser-to-live-MySQL end-to-end mutation test, Firefox/WebKit run, physical-device test or screen-reader audit was performed. Real backend behavior is tested independently in isolated MySQL.
- API response types are maintained in the client; backend validation remains authoritative. No generated OpenAPI client or global state library was introduced.
- Master catalogs are fetched pagewise into memory for selectors; employees/history remain server-paginated. Catalogs are small in the approved seed. New catalog writes/admin screens remain unimplemented.
- Production same-origin static hosting/reverse proxy, TLS and proxy trust remain deployment tasks. No deployment was performed.
- No performance benchmark was rerun in this frontend milestone. Milestone 3's designation grouping p95 of 500.02 ms still narrowly misses the strict under-500-ms target; frontend completion does not change that result.
- CSV import and its UI/tests are reserved for Milestone 5, subject to Milestone 4 review and approval. Historical salary corrections/reactivation/export remain outside this implementation.

No automatic commit or push. Suggested commit: `feat: add HR frontend with employee salary and analytics workflows`.


## Files and Git review

- Frontend: `client/src/App.tsx`, `main.tsx`, `styles.css`; typed API/hooks/format/types in `lib`; reusable common/filter/Button/Dialog components; auth, dashboard, employee form/list/detail and salary-history feature files.
- Tests/tooling: `client/test/{setup,fixtures,app.test,format.test}`, `client/e2e/workspace.spec.ts`, Vitest/Playwright configs, client package/tsconfig, root package scripts/lockfile and browser-artifact ignore rules. Existing `client/src/lib/utils.ts` received formatting only.
- Backend: `server/src/modules/master-data/routes.ts`, protected mounting in `server/src/app.ts`, catalog/auth coverage in `server/test/api.db.test.ts`.
- Documentation: README, this milestone, AI usage, decisions and `prompts/008-milestone-4.md`.

Git review confirms no staged files, tracked local `.env`, dependency directories or generated build/browser artifacts. `.env.example` remains the intentionally tracked template. No database dumps were added. No schema or migration file changed.


## Pre-commit verification — 2026-10-18

Human confirmation: “Milestone 4 frontend implementation and manual testing are complete.” This is user-reported manual verification; the following results were executed by AI against the current working tree. No application feature changes were made in this review.

| Exact command | Actual result | Exit |
|---|---|---:|
| `npm test` | Frontend: 32/32, 2 files, 2.77 s; backend: 32/32, 5 files, 829 ms | 0 |
| `npm run test:db` | 86/86, 3 files, 6.81 s | 0 |
| `npm run test:browser` | 6/6 Chromium checks, 5.9 s | 0 |
| `npm run lint` | No errors/warnings | 0 |
| `npm run typecheck` | Client and server passed | 0 |
| `npm run build` | Client Vite and server TypeScript production builds passed | 0 |
| `npm run db:validate` | Prisma schema valid | 0 |
| `npm audit --json > /tmp/m4-precommit-audit.json` | Zero reported vulnerabilities | 0 |
| `npm exec -w server -- tsx prisma/operations/verify-runtime.ts` | Read-only database checks passed | 0 |
| `git diff --check` | No whitespace errors | 0 |

Total: **156 passed, zero failures/skips**. Browser output included a harmless NO_COLOR/FORCE_COLOR environment warning. npm audit warned that package.json allowScripts takes precedence over the .npmrc setting; no configuration was changed.

Verification covers authentication/401 handling, CSRF and origin checks, cookie flags and token hashing; employee create/read/update/deactivate, filters and pagination; salary effective-date rules, immutable history and concurrent changes; analytics rendering, currency/filter requests, missing-rate/range errors and backend financial calculations. The three new GET lookup routes are protected by requireSession. Six related database cases passed: three anonymous-access cases plus catalog pagination/sorting, designation department/invalid-query filtering and active/inactive/all status behavior. No new master-data mutation routes exist.

Security review inspected auth middleware, client credential/CSRF handling and route mounting. Client source contains no localStorage/sessionStorage use, dangerouslySetInnerHTML or console logging. A filename/credential-pattern scan of tracked and untracked Git candidates found no unexpected sensitive/generated files; the only connection-string match was the intentionally tracked `.env.example`, using `REPLACE_LOCALLY` placeholders. `.env`, node_modules, client/server dist and browser test artifacts are ignored. `git diff --cached --name-only` is empty. These checks and npm audit are scoped review evidence, not a penetration-test guarantee. Production TLS/static-host security headers and trusted-proxy configuration remain deployment work.

Fresh read-only SQL results: **employees=10002, salaries=30704, inactive=401, departments=8, designations=24, countries=6, currencies=6, rates=12, users=1, sessions=2**. Compared with the 2026-10-17 snapshot, there is one additional salary and one additional session; this check does not establish their provenance. Duplicate salary effective dates, pre-hire salaries and negative amounts are all zero. Runtime salary UPDATE/DELETE remain denied (MySQL 1142), migration/runtime identities remain distinct, and all isolated test application tables are empty after cleanup. This review did not log into or mutate development data, migrate, seed or reset any database.

Current Git changes remain the frontend feature/shared component/API files; frontend/browser tests and tooling; package scripts/lockfile and ignores; the three lookup routes and backend integration coverage; README, AI usage, decisions, milestone evidence and prompt record. Only README, AI usage and this milestone document were edited during the pre-commit review. No files are staged; no commit/push occurred. Ready for the Milestone 4 commit, with the existing limitations above retained. No performance benchmark was rerun and no new p95 claim is made.
