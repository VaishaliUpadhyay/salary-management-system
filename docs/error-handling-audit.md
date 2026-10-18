# Project-wide error-handling audit

**Follow-up:** The troubleshooting dropdown and duplicated form summaries described below were removed in the [Milestone 6 presentation correction](error-ui-regressions.md). This document retains the original audit history; the follow-up describes current UI behavior.

Completed after Milestone 5. This work changes presentation and diagnostics, not database schema, business rules, authentication policy, or API response shapes. Development data was not changed. The separately prepared development cleanup remains unapproved and unexecuted.

## Findings and changes

| Area audited | Finding | Improvement |
|---|---|---|
| Shared frontend alert | Rendered arbitrary `Error.message`, backend messages and raw field paths; request ID appeared beside primary guidance | Central code/field-based presentation, safe unknown-error fallback, readable labels, collapsed troubleshooting reference |
| API client | Field issue codes were not typed; malformed details could reach rendering; unreadable successful responses surfaced JSON errors | Preserve structured codes, filter malformed detail entries, retain body/header request IDs, safe unreadable-response errors |
| Network and writes | Network read/write advice existed but was embedded in transport messages | Central guidance distinguishes failed reads, uncertain writes, and unreadable write responses; no automatic mutation retries |
| Authentication/session | Login and service failures could display machine codes; import duplicated security advice | Shared login/rate-limit/Origin/CSRF/session messages; existing session expiration, password clearing, cookie and CSRF behavior retained |
| Employee create/edit and filters | Server field errors only appeared in a technical summary | Accessible input errors and readable summaries; active assignment choices and department/designation filtering retained |
| Deactivation and salary history | Domain errors displayed raw messages | Shared conflict/inactive/not-found handling; confirmation, history preservation and existing success notifications retained |
| Salary forms | Locally authored errors were indistinguishable from unexpected exceptions | Explicit trusted `InputError`; targeted amount/date/hire-date guidance beneath inputs; backend remains authoritative |
| Analytics/reporting/FX | Boundaries submitted without frontend checks; filter names and FX metadata could appear as raw details | Exact decimal boundary validation before submission; readable invalid filter/date/currency, missing FX and numeric-range guidance; FX diagnostics are not presented as form fields |
| CSV import | Separate security mapping lost request IDs; row UI/export trusted arbitrary message strings | Reuse central security handling; map row codes and fields to safe guidance, retain row numbers/labels and export diagnostic codes; preserve formula-injection protection and partial/uncertain outcomes |
| Backend Zod validation | Default Zod diagnostics could include regexes and technical validation wording | Explicit field guidance preserving issue codes and paths and the existing response contract |
| Prisma/unexpected failures | Response sanitization existed but central server failure correlation logs were absent | Safe structured logs with request ID, status, code, route pattern, method, category and applicable Prisma code; no original error, SQL, inputs, secrets or stack dump |
| Incomplete CSV processing | Dedicated response bypassed central failure diagnostics | Safe request-correlated incomplete-import log with completed row count; partial-result contract unchanged |

The audit inspected all current frontend features, shared loading/error states, backend route modules, schemas, domain services, error middleware and import parsing/recovery. Backend domain messages need not match UI copy: stable codes and structured fields determine presentation, not substring matching. Raw diagnostic messages remain unused by the primary UI. Unknown map keys, including prototype-like keys, fall back safely.

## Examples

| Before | After |
|---|---|
| `Request validation failed` | Please check the information you entered. |
| `bucketBoundaries: Boundaries must start at zero and strictly increase` | Salary ranges must start at 0, and each subsequent value must be greater than the previous one. Additional guidance explains the 1–20 boundary and decimal limits. |
| `INVALID_CREDENTIALS` | Invalid email or password. Check your sign-in details and try again. |
| `SALARY_DATE_CONFLICT` | A salary revision already exists for this effective date. Review salary history and choose a different date; existing records cannot be overwritten. |
| Raw exception or unknown server message | We couldn't complete your request. Please try again. |
| Prominent `Reference: …` | Collapsed “Troubleshooting details” containing “Technical reference: …” |

Missing FX guidance does not promise that changing currency/date necessarily fixes missing coverage. Network-write guidance does not claim that a failed response means nothing was saved. Origin/CSRF guidance does not incorrectly assert that every security rejection is an expired session.

## Implementation locations

- `client/src/lib/errors.ts`: shared message catalog, labels, structured presentation and trusted local input errors.
- `client/src/lib/api.ts`, `format.ts`: transport normalization and exact boundary/salary validation.
- `client/src/components/common.tsx`, `OrganizationFilters.tsx`: accessible alerts, field errors, required-field indicators and filter guidance.
- Auth, employee forms/list, salary history and analytics dashboard integrate the shared layer. Employee detail/deactivation and application-level session/loading errors inherit it through their existing shared alert.
- `client/src/features/imports/ImportPage.tsx`, `report.ts`: safe CSV messages in UI and download.
- `server/src/lib/validation-messages.ts`, `validation.ts`, `errors.ts`: validation copy and sanitized diagnostic logs.
- `server/src/modules/imports/service.ts`, `routes.ts`: safe fallback and incomplete-import correlation logging.

## Actual validation

Final commands were run from the repository root. Test output was captured in local `/tmp/error-audit-*.log` files; these temporary logs are not repository artifacts.

| Exact command | Final result | Exit code |
|---|---|---:|
| `npm test` | Frontend: **91 passed**, 4 files. Backend: **97 passed**, 9 files | 0 |
| `npm run test:db` | **116 passed**, 3 files, isolated `salary_management_m1_test_20261015` database | 0 |
| `npm run test:browser` | **11 passed**, Chromium, mocked API responses | 0 |
| `npm run lint` | No ESLint errors or warnings | 0 |
| `npm run typecheck` | Frontend and backend passed | 0 |
| `npm run build` | Frontend Vite production build and backend TypeScript build passed | 0 |
| `git diff --check` | No whitespace errors | 0 |

**315 tests passed; zero final failures/skips.** Added 37 frontend cases, 5 backend cases and 2 browser cases. Updated existing assertions that deliberately expected technical codes or raw messages onscreen.

New coverage includes known domain/validation errors, multiple fields, unexpected exceptions/codes, prototype-like keys, safe CSV fallback, network reads versus writes, malformed response details, unreadable success responses, header/body request IDs, collapsed troubleshooting, field `aria-invalid`/`aria-describedby`, salary-range ordering and decimal precision. Existing suites also exercise authentication/expired sessions/logout, rate limiting, employee changes, salary constraints, missing rates, partial imports, concurrency and restricted database permissions.

Browser checks cover 1440/768/390/320px existing pages; new validation and troubleshooting checks cover 1440/320px, keyboard Enter activation, field descriptions and no document overflow. Existing dialog focus trapping, Escape and focus restoration tests pass.

During development an initial frontend typecheck identified an optional ARIA-property typing issue (fixed). Nine older frontend assertions initially failed because they expected replaced text, followed by two remaining stale assertions; final runs pass. A sandboxed backend run had five local-listener permission failures (92 tests passed), and a sandboxed browser attempt could not start its server; authorized reruns passed. These preliminary failures are not reported as successful checks. Playwright printed benign `NO_COLOR`/`FORCE_COLOR` environment warnings.

## Limitations and human review

- Human testing originally identified the problem. New copy and interactions have automated verification; fresh human UX approval and screen-reader testing remain pending.
- Browser tests mock APIs. Real API/security/database behavior is exercised separately in the isolated integration suite; no end-to-end test created or edited development records.
- Unknown error codes intentionally use a safe fallback. New backend codes/fields should receive explicit messages and regression tests.
- CSV `INVALID_FIELD` alone does not distinguish every missing/format/calendar failure; frontend guidance describes the valid field format without guessing from the backend message. Backend CSV responses retain their existing more specific authored messages and codes.
- Safe server logs deliberately omit raw stack traces and input values. They support correlation and failure categorization, not a full observability platform.
- No performance benchmarks were rerun; this task makes no new latency claims.
- No commit, push, deployment, schema change, seed, migration or development cleanup was performed. Pre-existing Milestone 5 and cleanup-preparation changes remain in the working tree.

Suggested commit message: `fix: unify user-friendly validation and error handling`
