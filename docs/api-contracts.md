# REST API contracts — approved design

Approved by the user for Milestone 1 on 2026-10-15. The design-stage descriptions below are preserved; implementation evidence and remaining live checks are tracked in [milestone-1.md](milestone-1.md).

Base path `/api/v1`. JSON except multipart CSV. See [database design](database-design.md) for types and calculation rules and [architecture](architecture.md) for boundaries. All routes require an authenticated HR session except login and a minimal health endpoint. No application code is included here.

## Shared conventions

- JSON camelCase; integer database IDs; immutable uppercase employeeCode is the external employee identifier. Currency/country/master codes normalize to uppercase. Unknown body/query fields are rejected to catch typos.
- Dates: real `YYYY-MM-DD` dates (1000-01-01 through 9999-12-31); timestamps: ISO UTC. Salary amount: nonnegative decimal string, at most 13 integral and two fractional digits; no exponent, comma or implicit rounding. Return money as fixed-two-decimal strings. Rates/factors are decimal strings with documented precision.
- Lists: `page=1`, `pageSize=25` (1–100), stable secondary `id` sort. Response `{data: [...], pagination: {page, pageSize, total, totalPages}}`; pages beyond the end return an empty list. Filtering precedes pagination. Capture UTC today once per request and return `salaryAsOfDate` where current salaries appear.
- Single-resource response `{data: {...}}`. Errors: `{error: {code, message, details: [{field?, code, message}], requestId}}`. Never return stack traces, SQL or credentials.
- HTTP 400 malformed syntax/query/CSV structure; 401 no valid session; 403 CSRF/origin failure; 404 absent ID; 409 unique/date/master conflict; 413 file too large/too many rows; 415 wrong content type; 422 valid syntax but failed field/business validation or missing FX; 429 rate limited; 500 unexpected failure; 503 temporary database unavailability. Row failures in a successfully processed CSV use HTTP 200.
- Mutating JSON endpoints require `application/json`; authenticated mutations require `X-CSRF-Token`, including multipart import. Login uses exact Origin validation plus JSON-only input instead of an anonymous CSRF token. All mutations require an allowed Origin. Credentials travel in HttpOnly session cookies. Sensitive responses use `Cache-Control: no-store`.
- No DELETE routes for employees, salaries or referenced master data; no PATCH salary route; no public signup or user administration. No generic retry promise for POST. EmployeeCode and salary unique keys support safe read-after-timeout reconciliation.

## Authentication

| Method/path | Request | Success |
|---|---|---|
| GET `/auth/csrf` | Authenticated cookie | 200 `{data:{csrfToken}}`; returns the existing session-bound token; 401 without a session |
| POST `/auth/login` | JSON `{email,password}` and allowed Origin | 200 `{data:{user:{id,email},csrfToken,expiresAt}}`; creates a fresh session and CSRF token, revoking any presented valid old session |
| GET `/auth/session` | Cookie | 200 `{data:{user:{id,email},csrfToken,expiresAt}}`; 401 if expired/revoked |
| POST `/auth/logout` | Cookie and CSRF token | 204; deletes session and expires cookie; expired session returns 401 and client clears its UI state |
| GET `/health` | None | 200 `{status:"ok"}` only; no infrastructure or employee data |

Login failures use one generic 401 response; proposed limiter: 5 failed attempts per IP per 15 minutes, returning Retry-After. Passwords are not trimmed. Session absolute lifetime is 8 hours, no sliding extension or remember-me. Store only authentication-token hashes in MySQL; the separate random CSRF token is stored in the session row and cannot authenticate requests by itself. Logout deletes the matching row. Single HR account does not imply a single device session. See architecture for the direct session middleware, CSRF and cookie rules; there is no anonymous session or custom token-signing layer.

## Employees

Employee representation: `{id,employeeCode,name,email,country:{id,code,name},designation:{id,code,name,department:{id,code,name}},hireDate,isActive,createdAt,updatedAt,currentSalary,nextFutureSalary}`. A salary summary is `{id,amount,currencyCode,effectiveDate}` or null. `nextFutureSalary` is the earliest future record, not the entire future schedule.

| Method/path | Request | Success / behavior |
|---|---|---|
| GET `/employees` | `q?`, `countryId?`, `departmentId?`, `designationId?`, `status=active\|inactive\|all` (active default), `sort=employeeCode\|name\|hireDate`, `order=asc\|desc`, pagination | 200 list and `salaryAsOfDate`. q is trimmed literal contains search over employeeCode/name/email, 1–100 characters; escape LIKE wildcards. All filters combine with AND. Default employeeCode ascending |
| POST `/employees` | `{employeeCode,name,email,countryId,designationId,hireDate,initialSalary:{amount,currencyCode,effectiveDate}}` | 201 employee, Location header; employee and initial salary created in one transaction; status starts active |
| GET `/employees/:id` | None | 200 employee and `salaryAsOfDate`, including inactive employees |
| PATCH `/employees/:id` | Nonempty subset `{name,email,countryId,designationId,hireDate}` | 200 updated employee; code/status/salary not writable here. Apply changes atomically |
| POST `/employees/:id/deactivate` | Empty JSON object | 200 employee with isActive=false; repeated deactivation returns same state |

Required text is nonempty after trimming; lengths follow the schema. Country/designation and its department must be active for new assignments. Unchanged existing references may remain retired on unrelated edits. `departmentId` is not accepted in employee writes because it is derived. Unknown filter IDs return 422; a valid department/designation combination with no matching employees returns empty results. Duplicate employeeCode returns 409 `EMPLOYEE_CODE_EXISTS`. Email need not be unique. Future hire dates are allowed, but initial/revised salary effectiveDate must be on/after hireDate (422 `SALARY_BEFORE_HIRE_DATE`). A hireDate edit later than the earliest existing salary effectiveDate is rejected with 409 `HIRE_DATE_CONFLICTS_WITH_SALARY`; history is never rewritten. No automatic status changes occur based on hireDate. Editing inactive employees is allowed; there is no reactivation endpoint in this MVP.

Master edits are last-write-wins for this single-manager MVP; no ETag/version protocol is proposed. Serialize employee-dependent writes where needed and document the multiple-tab risk.

## Salary revisions

| Method/path | Request | Success / behavior |
|---|---|---|
| GET `/employees/:id/salary-records` | `scope=all\|current\|historical\|future` (all default), pagination | 200 list with `salaryAsOfDate`; each row `{id,amount,currencyCode,effectiveDate,createdAt,createdBy:{id,email},classification}` |
| POST `/employees/:id/salary-records` | `{amount,currencyCode,effectiveDate}` | 201 revision, Location `/employees/:id/salary-records/:salaryId`; session supplies createdBy |
| GET `/employees/:id/salary-records/:salaryId` | None | 200 revision with classification and salaryAsOfDate; verify it belongs to requested employee |

All/history default order effectiveDate descending, future ascending; current returns zero or one row. Classification is computed at request time. Historical means earlier than current, future strictly after today. Backdated unique dates are accepted only on/after hireDate. For a well-formed POST, check active status first (409 `EMPLOYEE_INACTIVE`), then the hire-date bound (422 `SALARY_BEFORE_HIRE_DATE`), then date uniqueness. Same-date POST for an eligible active employee returns 409 `SALARY_DATE_CONFLICT`, even if identical; CSV has explicit skip semantics. Missing supported currency returns 422 `UNSUPPORTED_CURRENCY`. New revisions for inactive employees are rejected, including future/backdated records. Existing records remain readable and retain their date-based classification; default analytics excludes inactive employees. No endpoint changes or deletes prior revisions.

## Master data

All lists are paginated, name ascending with id tie-breaker, and accept `status=active|inactive|all` (active default). Designations additionally accept departmentId. Responses contain id, code, name, isActive, timestamps; designations also contain departmentId. Immutable code makes CSV mapping independent of renaming.

| Routes | Create body | Patch body |
|---|---|---|
| GET/POST `/departments`; GET/PATCH `/departments/:id` | `{code,name}` | Nonempty subset `{name,isActive}` |
| GET/POST `/designations`; GET/PATCH `/designations/:id` | `{code,name,departmentId}` | Nonempty subset `{name,isActive}` |
| GET/POST `/countries`; GET/PATCH `/countries/:id` | `{code,name}` | Nonempty subset `{name,isActive}` |

GET/PATCH return 200, POST 201 with Location. Codes and designation department cannot be changed; create a new designation and explicitly reassign employees instead. Countries require a supported ISO country code. Retiring a department prevents new assignments through all its designations without mutating their individual flags. Existing employee references remain valid. Name/code conflicts return 409; referenced master records are never deleted by API. Currency and rate catalogs are read-only.

## Reporting currency and exchange rates

| Method/path | Query | Success |
|---|---|---|
| GET `/currencies` | None | 200 `{data:[{code,name,isActive}]}`; supported bounded catalog, including currencies needed to display history |
| GET `/exchange-rates` | `reportingCurrency` required; `reportingDate` default today | 200 `{data:{baseCurrency:"USD",reportingCurrency,reportingDate,illustrative:true,rates:[{currencyCode,unitsPerUsd,effectiveDate,source,ageDays}],unavailableCurrencyCodes:[]}}` |

The rate endpoint lists latest nonfuture rows for supported currencies, explicitly marks missing coverage, and does not guarantee every employee can be converted. USD is seeded at 1; rates are not fetched live. reportingDate must be <= UTC today. Unknown/inactive reportingCurrency is 422. Original salary currencies remain displayable even if retired; historical rates remain usable for conversion.

## Analytics

`GET /analytics/compensation` accepts required `reportingCurrency`, optional `reportingDate`, `countryId`, `departmentId`, `designationId`, `includeInactive=false`, `groupBy=none|country|department|designation` (none default), and comma-separated `bucketBoundaries` (default `0,50000,100000,150000,200000`). All filters combine with AND. Only one grouping dimension at a time; cross-filtering remains available. Bucket boundaries are 1–20 increasing nonnegative decimal strings starting at zero, with at most two decimal places. Units are the selected reporting currency; final bucket has no upper limit. Intervals are lower-inclusive, upper-exclusive, applied to unrounded converted values.

200 response shape:

```json
{
  "data": {
    "salaryAsOfDate": "2026-10-15",
    "reportingDate": "2026-10-15",
    "reportingCurrency": "USD",
    "includeInactive": false,
    "groupBy": "none",
    "summary": {
      "employeeCount": 2, "salaryCount": 2, "missingSalaryCount": 0,
      "annualBasePayTotal": "150000.00", "average": "75000.00",
      "median": "75000.00", "min": "50000.00", "max": "100000.00"
    },
    "groups": [],
    "distribution": [
      {"lowerInclusive":"0.00","upperExclusive":"100000.00","count":1},
      {"lowerInclusive":"100000.00","upperExclusive":null,"count":1}
    ],
    "conversion": {"baseCurrency":"USD","illustrative":true,"rates":[],
      "pairs":[{"from":"USD","to":"USD","factor":"1","identity":true}]}
  }
}
```

Example uses `bucketBoundaries=0,100000` and two USD salaries. `conversion.rates` contains only actually used rows `{currencyCode,unitsPerUsd,effectiveDate,source,ageDays}`. Cross-currency pairs include factor and `sourceRateDate`/`targetRateDate`; source metadata is in rates. Identity pairs need no FX rows and are labeled identity rather than given fictitious source/date.

For grouping, `groups` contains `{id,code,name,summary,distribution}` for every group with at least one eligible employee, sorted by id, with no pagination at the seeded master-data scale. Overall summary/distribution always remain present. No-current employees contribute to employeeCount but not salary statistics or buckets. Empty matched population yields zero counts/total and null average/median/min/max. The number of entries is bounded by master cardinality; revisit group pagination only if scope grows.

422 `MISSING_EXCHANGE_RATES` includes missing currency codes, requested reportingDate, and affectedEmployeeCount, but no partial monetary results. Missing rates for unused currencies do not block a report. Reporting dates select FX only; there is no historical workforce analytics route. Converted amounts are annualized base-pay sums, not actual payroll paid. Use the multiply-then-divide expression and DECIMAL(65,24) computation values in database design, with final half-up rounding. Returned factors are informational decimal strings (up to 30 fractional places); never calculate totals from rounded factors. A numeric-range failure returns 422 `REPORT_NUMERIC_RANGE_EXCEEDED` without partial monetary values.

## CSV import

`POST /imports/employees` accepts multipart field `file`, UTF-8 CSV with optional BOM, quoted fields and CRLF/LF support. Maximum 5 MiB and 10,000 data records; exactly one file. Reject malformed quoting, missing/unknown/duplicate headers, invalid UTF-8, oversized input and excess rows before any writes. No persistent upload storage or background job is required. Limits apply to actual streamed bytes, not only Content-Length.

Exact required headers (order arbitrary):

```text
employee_code,name,email,country_code,department_code,designation_code,hire_date,annual_base_salary,currency_code,effective_date
```

One logical CSV record per employee. Row numbers count records including header as row 1; quoted embedded newlines do not increment record number. Empty records are reported as rejected, not silently dropped. Validate all rows and identify duplicate normalized employee_code values across the whole file before writing anything. Reject **every** affected duplicate row, even if otherwise identical. Continue processing nonduplicate valid rows. One-row-per-employee files deliberately cannot carry multiple revisions for the same employee in one import.

Map country_code, department_code and designation_code to existing master records; verify the designation belongs to that department. Never auto-create master data. All columns are required, including master values for existing employees. New employees require active references/currency; unchanged retired master references are allowed for existing employees. New revisions require active supported currency; an identical already-recorded salary can still be skipped if its currency has since been retired.

**User-confirmed policy (2026-10-15): keep existing employee master fields unchanged and reject mismatches.** For an existing employeeCode, compare normalized name, email, country, designation/derived department and hireDate. Any mismatch rejects the entire row as `EMPLOYEE_MASTER_MISMATCH`, listing fields; edit the employee through its API and retry. Import does not change status or reactivate employees. Names compare case-sensitively after trimming; email/code compare normalized values.

Per-row transaction after validation:

1. New code: require effectiveDate >= hireDate or reject `SALARY_BEFORE_HIRE_DATE`; create active employee and initial salary atomically; outcome `created`. Future hire/salary dates are allowed.
2. Existing code with master mismatch: reject, regardless of salary equality.
3. Matching master and existing date with identical amount (decimal equality) and currency: `skipped`, no writes, including for an employee deactivated since the original import.
4. Matching master and existing date with different amount/currency: `rejected`, `SALARY_DATE_CONFLICT`.
5. Matching master and new date: reject `EMPLOYEE_INACTIVE` if inactive; otherwise reject `SALARY_BEFORE_HIRE_DATE` if the date precedes hireDate. If eligible, insert salary only; outcome `updated` means a revision was added, not an employee edit. Perform these checks with the employee row locked in the row transaction.

Process records sequentially, one transaction per accepted row. Concurrent unique conflicts trigger rereading and applying the same policy, not a generic skipped result. Bounded retry for deadlocks; exhausted per-row transient failures are rejected as retryable and later rows continue if the database remains usable. Cancellation/infrastructure failure can leave a committed prefix: retrying the file safely reclassifies it. A disconnected client is not evidence of rollback.

200 response:

```json
{
  "data": {
    "totalRows": 4,
    "counts": {"created":1,"updated":1,"skipped":1,"rejected":1},
    "rows": [
      {"rowNumber":2,"employeeCode":"EMP00001","outcome":"created","employeeId":1},
      {"rowNumber":3,"employeeCode":"EMP00002","outcome":"updated","employeeId":2},
      {"rowNumber":4,"employeeCode":"EMP00003","outcome":"skipped","employeeId":3},
      {"rowNumber":5,"employeeCode":"EMP00004","outcome":"rejected",
       "errors":[{"field":"annual_base_salary","code":"INVALID_AMOUNT","message":"Must be non-negative"}]}
    ]
  }
}
```

Every data record has exactly one outcome; counts sum to totalRows. Errors can contain multiple field failures. Re-importing unchanged accepted records creates no additional salary rows. An all-rejected valid file still returns 200 with row results. Fatal parse/size errors return request-level errors with zero writes. A fatal database failure after work begins returns 503 with available completed counts and `processingIncomplete:true`; do not present unprocessed records as accepted or claim whole-file rollback. Upload contents are discarded after the request and never logged.

**Synchronous timeout risk:** 10,000 sequential row transactions may exceed browser/client, proxy, load-balancer or application request deadlines. A gateway 504/network disconnect can occur after rows commit, and the application may have no opportunity to return counts or a 503 body. UI must report an unknown/incomplete outcome, not zero writes or full rollback, and offer deliberate re-import; unchanged rows skip, subject to the same current master/status rules. Measure worst-case import duration on the chosen host and configure compatible deadlines before promising the 10,000-row limit. Keep whole-file duplicate validation and the existing partial-success design; do not silently split files or add a job queue. If hosting cannot accommodate it, changing limits or introducing jobs requires a separate decision.

## Contract edge-case test matrix

| Area | Required cases |
|---|---|
| Salary dates | Today, UTC midnight crossover, leap day/invalid date, future-only, multiple future, backdated earlier/later than current, identical/conflicting same date, pre-hire rejected/equal-hire accepted, future hire, inactive new revision rejected, inactive CSV replay skipped, hire-date edit invalidating history, concurrent deactivation |
| Identity/master data | Normalized duplicate codes, equal employee email allowed, wrong department/designation CSV pair, retired assignment versus unchanged reference, immutable code |
| CSV | All duplicates rejected, BOM/quotes/newlines, blank record, invalid headers/oversize before writes, amount formatting equivalence, master mismatch even for identical salary, rollback on new employee salary failure, replay after partial success, concurrent insert, timeout after committed prefix with lost response |
| Analytics | Odd/even median, zero/no-current salaries, future exclusion, inactive toggle, filtered grouping, empty population, bucket boundary equality, missing versus unused rates, identity conversion, mixed rate dates, precision/overflow |
| Security | Login failure, expiry/logout, missing/tampered CSRF, wrong Origin, unauthenticated access to every data route, employee/salary ID mismatch, injection-like search |
