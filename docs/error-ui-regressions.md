# Milestone 6 — error presentation correction

This corrective task reuses the existing centralized mapper and shared `ErrorNotice`/`Field` components. It does not redesign error handling or change backend logic, API contracts, tracing, schema, validation, business rules or development data.

## Root causes

- The shared alert unconditionally added expandable troubleshooting UI whenever a response included a request ID.
- Forms repeated the same guidance in both the alert's detail list and the input's error description. Some domain errors also repeated the title inside that list.
- Dashboard local boundary errors inserted an entire alert as another child of a compact horizontal input/button row.
- Required indicators occupied separate rows, unnecessarily increasing form height.
- Alert content lacked explicit flex shrinking constraints; retry buttons could sit beside the last line of text.
- CSV error cells had a hard minimum width. Mobile screenshots showed validation messages outside the initial table viewport.

## Changes

- Removed troubleshooting controls and request IDs from the shared frontend alert entirely. Request IDs and codes remain in transport objects, backend responses and existing safe logs.
- Login now says exactly: **“Invalid email or password. Please try again.”**
- Form callers identify fields with inline guidance. The existing shared alert suppresses those repeated details, while field errors keep `role="alert"`, `aria-invalid` and `aria-describedby`. Unmapped errors still receive a safe summary.
- Removed duplicate title/detail messages, the extra dashboard boundary alert, and redundant description IDs. Required indicators share the label row.
- Reduced alert padding/margins; constrained flex content and wrapping; placed retry controls on their own line.
- CSV errors retain row numbers, labels, readable guidance and downloads. Fixed-width row/outcome columns and wrapping cells keep the existing table within the page, including long employee codes. Long mobile rows grow vertically rather than hiding validation messages horizontally.

## Files changed in this corrective task

Application:
- `client/src/components/common.tsx`
- `client/src/lib/errors.ts` (login wording only)
- `client/src/styles.css`
- `client/src/features/auth/Auth.tsx`
- `client/src/features/employees/EmployeeForm.tsx`
- `client/src/features/employees/Employees.tsx`
- `client/src/features/salaries/SalaryHistory.tsx`
- `client/src/features/analytics/Dashboard.tsx`
- `client/src/features/imports/ImportPage.tsx`

Tests:
- `client/test/errors.test.tsx`
- `client/e2e/workspace.spec.ts`

Documentation:
- `README.md`
- `docs/ai-usage.md`
- `docs/error-handling-audit.md` (historical audit marked as superseded for presentation)
- `docs/error-ui-regressions.md`
- `prompts/011-error-ui-correction.md`

Pre-existing worktree changes from earlier tasks were preserved. No backend source files were changed by this corrective task.

## Rendered UI verification

Chromium tests exercised these states at **375px, 768px and 1440px**:

- Invalid login credentials, short message only.
- Dashboard invalid range input, with existing charts still visible.
- Missing FX rates/report failure.
- Employee listing service failure.
- Employee creation with multiple field errors and no repeated summary.
- Employee editing with a hire-date conflict.
- Salary revision effective-date conflict.
- Salary history failure, keeping the employee's other information visible.
- Employee detail failure.
- CSV results with multiple long messages and a long employee code; download button remains available.

Assertions check document overflow, hidden technical identifiers/controls, alert counts, accessible input descriptions and field-error geometry. Existing browser tests also verify focus trapping, Escape dismissal, focus restoration and CSV download behavior.

Actual browser screenshots were generated and inspected, including mobile login/ranges/salary/history/CSV, tablet creation/FX, and desktop editing/listing. Inspection led to additional retry-button and CSV-column fixes, followed by successful reruns. Local screenshots are `/tmp/m6-errors-{screen}-{width}.png`; they contain mocked synthetic data and are not committed artifacts.

## Actual final results

| Command | Passed | Failed | Exit code |
|---|---:|---:|---:|
| `npm test` — frontend | 93 | 0 | 0 |
| `npm test` — backend | 97 | 0 | 0 |
| `npm run test:db` — isolated integration database | 116 | 0 | 0 |
| `npm run test:browser` — Chromium | 15 | 0 | 0 |
| `npm run lint` | Passed | — | 0 |
| `npm run typecheck` | Frontend/backend passed | — | 0 |
| `npm run build` | Frontend/backend production builds passed | — | 0 |
| `git diff --check` | Passed | — | 0 |

**321 tests passed, zero failed/skipped.** Existing authentication, API, salary, analytics, CSV and database permission coverage remains passing. Local output logs: `/tmp/ui-fix-{tests,db,browser,lint,typecheck,build}.log`. Browser output includes harmless NO_COLOR/FORCE_COLOR warnings.

## Remaining verification limits

No unresolved overlap or page-overflow issue was observed in the checked Chromium states. Longer error content naturally increases form/row height; no formal cumulative-layout-shift metric was collected. Very long CSV identifiers/messages wrap into taller rows on narrow screens. Native screen-reader, Safari/Firefox, browser zoom and real-device touch review remain advisable; they were not performed or claimed. Browser API responses were mocked; real backend integration tests used the guarded isolated database, not development records.

No reset, seed, migration, deployment, commit or push was performed. The separately proposed development cleanup remains unexecuted. No other Milestone 6 work was started.
