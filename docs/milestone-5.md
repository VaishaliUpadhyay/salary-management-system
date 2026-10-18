# Milestone 5 — CSV import and partial-success reporting

Implementation: 2026-10-18. Human Milestone 5 review/manual acceptance remains pending. No schema, migration, historical salary or development workforce changes; no deployment, commit or push.

## Endpoint and file contract

`POST /api/v1/imports/employees`, multipart/form-data with **exactly one `file` part** and no extra form fields. Requires the existing HR session cookie, exact allowed Origin and `X-CSRF-Token`. Login/employee/salary JSON routes remain JSON-only; imports share their session, Origin and CSRF checks without weakening CORS.

UTF-8 `.csv` (optional BOM), quoted commas, doubled quote escapes, quoted newlines, LF/CRLF. Maximum **5 MiB actual file bytes** and **10,000 logical data records**. Multipart framing is additionally bounded to file limit plus 64 KiB. File size is measured while streaming, independently of Content-Length. A bounded Busboy upload buffer and csv-parse preflight replace custom multipart/quote parsing. No files are persisted or logged.

Exactly these headers, in any order, with no missing/unknown/duplicate columns:

```csv
employee_code,name,email,country_code,department_code,designation_code,hire_date,annual_base_salary,currency_code,effective_date
M5DEMO001,Alex Sample,alex.sample@example.test,US,ENG,ENG_1,2024-01-01,75000.00,USD,2024-01-01
```

Header-only/zero-byte files fail. Malformed quoting, inconsistent nonblank record widths, invalid UTF-8/NUL, wrong file format and file/row limits are file-level errors **before any writes**. Blank logical records remain rejected rows. Row 1 is the header; embedded quoted newlines do not change logical row numbering.

There is deliberately **no status column** in the approved contract. New employees are active; existing status is preserved, with inactive new revisions rejected. A supplied status column is an invalid header, not a way to deactivate/reactivate employees.

## Row validation and transactions

- Shared Zod employee/salary validation: normalized uppercase identifiers, trimmed case-sensitive names, lowercase emails, real UTC dates, non-negative DECIMAL(15,2) salary strings. Exponents, excessive precision, negatives and out-of-range amounts fail. Email is not employee identity.
- Resolve country/department/designation/currency codes from existing catalogs; verify designation membership. No master records are created. Catalogs are loaded once per request to avoid per-row lookup queries; they are a request snapshot. There are currently no master write APIs in the application; future administrative writes would need a concurrent-retirement consistency review.
- Preflight scans every normalized employee code; **all occurrences** of a duplicate code are rejected, including otherwise valid/identical rows. A file carries at most one revision per employee.
- Each accepted row uses its own read-committed Prisma transaction. Existing employee rows are locked using the same helper as salary additions, hire-date edits and deactivation. No existing employee master fields are overwritten.
- New code: active references/currency, valid date on/after hire, atomic employee plus initial salary → `created`.
- Existing code: name/email/country/designation/hire-date mismatch → `EMPLOYEE_MASTER_MISMATCH` before salary comparison. Department/designation inconsistency is separately rejected.
- Matching masters and same date: decimal-equal amount and identical currency → `skipped`, even if employee or currency is now inactive. Different salary/currency → `SALARY_DATE_CONFLICT`.
- Matching masters and new date: inactive employee → `EMPLOYEE_INACTIVE`; pre-hire date → `SALARY_BEFORE_HIRE_DATE`; otherwise insert salary only → `updated`. Future dates and zero amounts are allowed. Original currencies are preserved; no conversion occurs during import.
- Unique/deadlock/transaction-contention failures get at most three attempts, each in a fresh row transaction. Unique races reread and apply the full policy. Exhausted transient rows become retryable rejections if a health query succeeds; later rows continue. Infrastructure failure returns incomplete progress. New-employee salary failure rolls back that row's employee insertion.

## Responses and recovery

HTTP 200 is returned for a structurally valid, fully processed file, even if every row is rejected:

```json
{"data":{"totalRows":2,"counts":{"created":1,"updated":0,"skipped":0,"rejected":1},"rows":[{"rowNumber":2,"employeeCode":"M5DEMO001","outcome":"created","employeeId":123},{"rowNumber":3,"employeeCode":"M5DEMO002","outcome":"rejected","errors":[{"field":"effective_date","code":"SALARY_BEFORE_HIRE_DATE","message":"Salary effective date must be on or after hire date"}]}]}}
```

Example IDs are illustrative. On full completion, counts sum to totalRows and every record has exactly one outcome. Row errors may list multiple fields. `updated` means salary insertion, not master-data modification.

File failures use the existing `{error:{code,message,details,requestId}}` envelope: 400 invalid CSV/headers/multipart, 413 file/row limit, 415 unsupported media/file; authentication/security remain 401/403. No raw uploaded values, filenames, stack traces or database diagnostics are included in errors. Valid employee codes and logical record numbers identify affected records; names/emails/salary values are excluded from the error download.

A fatal processing failure returns 503 with the standard `error` and sibling `data` containing completed counts/rows, original totalRows and `processingIncomplete:true`. Unresolved records are not counted as rejected or successful. Cancellation is checked between rows; an in-flight row may commit. A gateway timeout/disconnect can lose the entire response after a committed prefix. UI labels this **unknown/incomplete**, never rollback or zero writes. Deliberate replay reclassifies unchanged records under current master/status rules; there is no automatic mutation retry, durable job, resumable upload or permanent result history.

## Frontend

Import navigation and protected `/#/imports` page; labeled file input, limits/schema guidance, downloadable header template, pre-upload extension/size/empty checks, busy state and disabled duplicate submissions. The existing API utility sends FormData without manually setting its boundary, includes credentials and memory-only CSRF, and retains partial 503 results. Session expiry uses the existing protected-routing behavior.

Results distinguish total, created, salary revisions, skipped, failed and unresolved records. A 50-row paginated table includes every returned outcome and validation messages. Error CSV downloads escape all fields and prefix formula-like values (including leading whitespace/control characters); no upload content is echoed into the report. Keep the page open during import: hard navigation warns, but ordinary in-app navigation can lose the report while the server finishes. Unknown outcomes require explicit inspection/reimport.

## Tests and verification

Final verification on 2026-10-18:

| Command | Actual result | Exit |
|---|---|---:|
| `npm test` | 53 frontend tests (3 files, 2.87 s) + 59 backend tests (7 files, 951 ms) | 0 |
| `npm run test:db` | 116 tests, 3 files, 5.82 s | 0 |
| `npm run test:browser` | 9 Chromium tests, 6.2 s | 0 |
| `npm run lint` | No errors/warnings | 0 |
| `npm run typecheck` | Client and server passed | 0 |
| `npm run build` | Vite client and TypeScript server production builds passed | 0 |
| `npm run db:validate` | Prisma schema valid | 0 |
| `npm run bench:imports` | All six measurements and cleanup passed | 0 |
| `npm audit --json > /tmp/m5-audit.json` | Zero reported vulnerabilities | 0 |
| `npm exec -w server -- tsx prisma/operations/verify-runtime.ts` | Permissions/counts/invariants and cleanup passed | 0 |
| `git diff --check` | No whitespace errors | 0 |

**237 tests passed, zero final failures/skips**; 81 tests added beyond Milestone 4. Chromium checked upload/results/error download at 1440/390/320 px alongside all previous dashboard/profile checks. AI inspected the mobile import screenshot; this is not human review or a full accessibility audit.

 Fixtures and benchmarks run only in the existing isolated `salary_management_m1_test_20261015` schema. Empty-schema guards reject unexpected data; cleanup targets suite-owned rows and never resets/truncates a schema. Browser APIs are mocked.

Coverage includes CSV quoting/encoding/header/blank-row behavior; 5 MiB and 10,000-row boundaries; row validation; references and department consistency; master mismatch; zero/future salaries; all duplicate-code rows; same-date equal/conflicting replay; inactive/retired replay; atomic rollback on FK failure; concurrent new employees/same-date revisions/deactivation; authentication, Origin/CSRF, extra parts and malformed multipart; incomplete progress/cancellation/bounded retry; upload states, downloads/formula safety, partial results, 401/403/413, network uncertainty and responsive layouts.

Initial integration run: 95 passed/20 failed because multipart partsLimit=1 fires at the first completed part in Busboy; corrected to permit the single required part while rejecting extras. Subsequent integration run passed all 115 then-existing tests. Initial typechecks found optional filename and benchmark cleanup narrowing issues; corrected. Lint required an explicit justification for the intentional formula-injection control-character regex. These are initial failures, not final results. Final review also moved all Zod field validation into whole-file preflight before any row write; affected tests and timing/memory benchmarks were rerun successfully.

## Measured performance

Command: `npm run bench:imports` (exit 0). Raw machine-readable evidence: [milestone-5-imports.json](performance/milestone-5-imports.json).

macOS arm64, Apple M1 (8 logical CPUs, 8 GiB host memory), Node v24.20.0, MySQL 8.0.46 in local Docker. One synchronous request at a time. Full multipart HTTP response through Supertest, including upload parsing, row transactions and response serialization. Two countries, departments/designations and currencies, with zero and future-hire salary cases. One final run per size/mode; no percentile, repeatability or production-capacity claim. An initial run before moving all field validation into preflight overlapped mocked Chromium checks; its measurements are retained separately in the raw evidence. Final measurements below use the final preflight implementation; other host activity was not controlled.

| Rows | Mode | Time ms | Created | Updated | Skipped | Rejected | Peak Node RSS MiB | SQL statements |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 100 | Create | 391.60 | 100 | 0 | 0 | 0 | 277.14 | 806 |
| 100 | Replay | 304.47 | 0 | 0 | 100 | 0 | 277.59 | 706 |
| 1,000 | Create | 3,415.89 | 1,000 | 0 | 0 | 0 | 290.30 | 8,006 |
| 1,000 | Replay | 2,001.93 | 0 | 0 | 1,000 | 0 | 227.91 | 7,006 |
| 10,000 | Create | 29,956.21 | 10,000 | 0 | 0 | 0 | 272.72 | 80,008 |
| 10,000 | Replay | 18,449.28 | 0 | 0 | 10,000 | 0 | 333.23 | 70,010 |

RSS is sampled every 10 ms and includes the test client/harness, parser, Prisma and API in one Node process; short spikes may be missed and MySQL memory is excluded. Garbage collection makes peaks non-monotonic. File sizes were 13,968 / 141,544 / 1,444,268 bytes. Final SQL counts independently verified **11,100 employees and 11,100 salaries**, unchanged by replay; fixture cleanup verified all isolated application tables empty.

Database work scales roughly eight statements/new row and seven/replay, including transaction controls; four reference catalog queries occur once per file. Per-row transaction/round-trip cost is the observed scaling bottleneck. No profile isolates commit/fsync time from network latency. Employee-code and employee/effective-date unique indexes serve lookups; no speculative schema/index changes were made. A whole-file bulk transaction would replace the required independently committed row transactions, so it was not substituted.

**Timeout limitation:** final 10,000-row creation took 29.96 seconds, leaving effectively no headroom under a 30-second gateway deadline. The initial run took 37.22 seconds; both demonstrate timeout risk, not a safe 30-second operating limit. Choose compatible hosting deadlines only after measuring the deployment environment. No production timeout settings, queue, limit reduction or background architecture was introduced. The ordinary list/analytics p95 target does not apply to full-file import completion; prior analytics limitations remain unchanged.

## Manual walkthrough

Only perform this on a database where you intend to add synthetic test records. Automated work did not upload this sample to development.

1. Start `npm run dev`, open http://localhost:5173 and sign in; choose Import.
2. Use [employee-import.csv](examples/employee-import.csv). It assumes active seed codes US, ENG, ENG_1, USD/EUR and unused M5DEMO001–003.
3. First upload should create two employees and reject M5DEMO003 because its salary predates hire. Inspect row 4 and download the error report.
4. Reupload unchanged: two skipped, one rejected, no extra salaries. Change the third effective_date to 2024-01-01: two skipped, one created.
5. For a matching employee, use a new effective_date to add a revision (`updated`). Change the amount at an existing date to see a conflict; change the name to see a master mismatch. Do not expect import to edit a profile.
6. Try an oversized/unsupported file and missing header; verify clear file error and no results claiming success. Log out or expire the session and verify protected access. Inspect at mobile width and use keyboard navigation.

## Files, security and remaining limitations

New import backend module (`csv`, `upload`, `service`, `routes`), frontend ImportPage/report utilities, parser/recovery/UI tests, isolated API cases, benchmark harness/evidence and sample CSV. Modified auth middleware composition, app route mounting/navigation, typed API utility, browser checks, root/server scripts and package lock. Added only Busboy, csv-parse and Busboy types; no new frontend dependency, schema or migration.

Security: authentication precedes upload parsing; exact Origin and constant-time CSRF reuse; no CORS change; streamed limits and complete preflight; parameterized Prisma/SQL; existing restricted database role; no salary update/delete. No raw upload/secret logging. CSV error export is the explicitly requested import-error report, not a general salary/report export feature.

Human Milestone 5 review is pending. Browser tests use mocks; no live full-stack browser import, other browser engines, screen-reader audit, production proxy or multi-request load benchmark is claimed. Upload memory is bounded per request, not a global concurrent-request memory quota. Reference catalogs assume the existing small master datasets. Files/results are not retained after the request/page lifecycle. CSV supports one record per employee per file, not multiple historical revisions in a single file. No reactivation or historical correction workflow.

Suggested commit: `feat: add validated CSV imports with partial-success reporting`.


## Database and Git verification

Read-only results after tests/benchmarks: employees **10002**, salaries **30704**, inactive **401**, departments **8**, designations **24**, countries **6**, currencies **6**, rates **12**, users **1**, sessions **2**. Duplicate effective dates/pre-hire salaries/negative salaries: **0** each. Runtime salary UPDATE/DELETE denied with MySQL 1142; runtime/migration credentials remain distinct. All isolated application tables are empty. No development data was changed by this milestone.

No credentials, local `.env`, node_modules, build output, browser artifacts or database dumps are staged/tracked unexpectedly; `.env.example` remains an intentional placeholder template. No files are staged. The dependency audit and scoped source/Git checks are not a penetration-test guarantee.

Dependency commands (exit 0 after the initial sandbox ENOTFOUND retry): `npm install -w server --save-exact busboy csv-parse` and `npm install -w server --save-dev --save-exact @types/busboy`. Formatting used the pinned `npm exec --yes --package=prettier@3.6.2 -- prettier --write` on touched implementation/tests (exit 0 after sandbox ENOTFOUND); it added no project dependency. Installed parser versions are pinned in package-lock.json. Harmless npm allowScripts precedence and Playwright color-environment warnings were observed.

## Manual-review refinement — HR-friendly validation (2026-10-18)

The user reported developer-oriented CSV messages during manual testing. CSV validation now maps structured Zod issue codes and field paths to actionable backend messages, without parsing exception text or changing accepted formats. Missing values, date format versus calendar errors, salary precision/range, employee IDs/names/emails, catalog references, mismatches, inactive restrictions, duplicate records, malformed files, headers, encoding and limits have clearer explanations. Related issues for a single field are presented once; all affected fields remain included.

The results table uses human-readable labels and statuses, retains row numbers and multiple field messages, and no longer shows diagnostic codes in primary content. Error downloads add `field_label` beside the original `field`, retaining codes and formula-injection protection. Session/CSRF/origin failures use actionable, code-based UI advice; shared authentication behavior remains unchanged.

Validation: `npm test` passed **54 frontend + 92 backend tests**, `npm run test:db` passed **116**, and `npm run test:browser` passed **9**, all exit 0 (**271 total; zero final failures/skips**). Backend tests were rerun after removing encoding jargon (92 passed, exit 0). Lint, both TypeScript checks and both production builds passed. An initial new UI assertion caught missing spacing between the label and message; corrected and rerun. No import benchmark rerun was needed for message-only changes; prior performance evidence remains historical.

Files touched by this refinement: backend imports `messages.ts` (new), `csv.ts`, `upload.ts`, `service.ts`; frontend imports `ImportPage.tsx`, `report.ts`; `server/test/import-messages.test.ts` (new), parser tests and frontend import tests; README and AI usage/milestone documentation. No CSV input schema, database schema, employee/salary record, transaction or replay policy change. Database tests used isolated fixtures only. No commit/push or Milestone 6 work.

Diagnostic codes and raw field names remain intentionally available in API responses and the downloaded troubleshooting columns. A request reference ID may still appear for support. Other employee/salary forms retain their existing messages; this refinement is scoped to CSV import. No raw regex, Zod or Prisma exception text is used for CSV row validation messages.
