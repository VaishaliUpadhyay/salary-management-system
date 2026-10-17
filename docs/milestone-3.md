# Milestone 3 — Salary analytics and currency reporting

Implementation/evidence recorded 2026-10-17. Milestone 2 was reviewed and committed by the user. The user has confirmed Milestone 3 implementation and manual API testing are complete and that Salary Analytics, Reporting and Currency Conversion APIs work. Milestone 4 has not begun.

## Pre-commit validation and human verification — 2026-10-17

**Status: completed and manually verified by the user.** Human verification is the user's confirmation that Salary Analytics, Reporting and Currency Conversion APIs work; no detailed manual scenario transcript was supplied. The financial assertions below are independently specified automated checks executed by AI, not claims of additional human tests.

Fresh command chain:

```bash
npm test && npm run test:db && npm run lint && npm run typecheck && npm run build
```

| Command | Actual result | Exit |
|---|---|---:|
| `npm test` | 5 files, 32 passed; 0 failed/skipped; 752 ms | 0 |
| `npm run test:db` | 3 files, 80 passed; 0 failed/skipped; 5.34 s | 0 |
| `npm run lint` | No errors or warnings | 0 |
| `npm run typecheck` | Client and backend passed | 0 |
| `npm run build` | Vite production frontend and TypeScript backend builds passed | 0 |

Total: **112 passed, 0 failed, 0 skipped**. The entire chain exited 0. No application feature changes, development database writes, seeds, migrations or resets occurred in this pass. Integration tests used the isolated schema and their existing fixture setup/cleanup.

Performance was **not rerun** during this pre-commit check. The performance section preserves actual measurements recorded at `2026-10-17T04:56:11.468Z`: analytics p95 summary/country/department/designation/combined-filter = **395.92 / 488.62 / 491.10 / 500.02 / 31.68 ms**. The strict under-500-ms target remains unmet for designation grouping; manual functional verification does not remove that limitation.

Git review: `git status --short`, tracked/untracked file inspection and staged-file inspection found **nothing staged** and no tracked/unignored real `.env`, generated builds, dependency directories or private-key files. `git check-ignore -v server/.env node_modules client/dist server/dist` confirmed those local artifacts are ignored. A targeted credential-pattern scan found no non-placeholder MySQL passwords, private-key blocks or GitHub tokens in tracked/unignored text; this is not an exhaustive secret audit. `.env.example` templates are intentional source files. Milestone 3 source/tests/scripts/docs remain available for selective staging; no commit or push was performed.

## Implemented endpoints

All endpoints use existing session authentication, safe error envelopes and no-store response headers under `/api/v1`:

| GET endpoint | Behavior |
|---|---|
| `/analytics/compensation` | Current employee/salary/missing-salary counts; annual total, average, median, minimum, maximum; distribution; optional country/department/designation grouping |
| `/currencies` | Supported bounded currency catalog, including retired currencies used by history |
| `/exchange-rates` | Latest rates on/before reporting date, source/date/age, illustrative label and unavailable currency codes |

Analytics requires `reportingCurrency`; accepts reportingDate, countryId, departmentId, designationId, includeInactive, groupBy and bucketBoundaries per the approved contract. Filters combine with AND; unknown IDs fail explicitly. Unknown fields, duplicate query parameters, malformed dates, nonboolean flags, unsupported groups and invalid buckets are rejected. Unknown/inactive reporting currencies and future reporting dates return 422.

Inactive employees are excluded by default. Active future hires count as employees with missing current salaries. Salary selection always uses the request's captured UTC date, selecting exactly one latest effective revision per employee. A past reportingDate selects FX only. No-current salaries are excluded from salary statistics; genuine zeros remain included. Empty monetary populations have total `0.00`, other monetary statistics null and empty buckets. Group labels use current assignments; no historical organizational accuracy is claimed.

## Implementation and financial precision

- A small analytics module contains schemas, routes, service, SQL repository and precision guards. Existing schema/indexes and runtime permissions are unchanged; no dependency, cache, external FX service or driver is added.
- A repeatable-read transaction covers filters, FX coverage, numeric bounds and aggregates. SQL selects eligible employees, groups effective salary dates and joins back on the unique employee/date index. A currency-level coverage query returns counts and maxima, not every employee's salary.
- SQL computes totals, averages, extrema and distribution. Median uses ROW_NUMBER and COUNT over the same partition, averaging the one/two middle positions. Overall and group rows share the converted population. An evidenced `NO_MERGE(converted)` hint prevents MySQL duplicating salary joins before expansion; the common named window avoids a second sort. No money aggregation occurs in Node or the browser.
- Conversion uses `CAST(CAST(amount * target_rate AS DECIMAL(49,24)) / source_rate AS DECIMAL(65,24))`. Both rates are DECIMAL(24,12); same-currency values bypass FX. Each required USD leg uses a dated USD row. Rates are independently selected on/before reportingDate and retain original source/date metadata.
- Verify `div_precision_increment=4` on each reporting transaction's actual connection; restore and reverify if needed. Rank and buckets use 24-place computation values. SQL rounds final aggregates half-up to two places, not each employee to cents first. Display factors are informational strings rounded to at most 30 fractional places; they never drive totals.
- Missing required source/target rates fail the entire monetary report with `MISSING_EXCHANGE_RATES` and missing codes, reporting date and affected-employee count in the error detail envelope. Unused missing rates do not block a report; even zero cross-currency salaries require coverage.

### Approved numerical safeguard

The user approved **“Use Prisma with range checks”** after the MySQL prepared-diagnostic limitation was explained. See [decisions](decisions.md). Direct SELECT-warning inspection is not implemented or claimed; [MySQL documents that diagnostics cannot be prepared](https://dev.mysql.com/doc/refman/8.0/en/sql-prepared-statements.html).

Before conversion, local 100-digit decimal arithmetic calculates conservative per-currency maximum × count bounds (a small bounded catalog), checks computation/aggregate capacity and prevents out-of-range bucket casts. Unsafe reports return 422 `REPORT_NUMERIC_RANGE_EXCEEDED`, without partial monetary results; known MySQL numeric errors map to the same response. Source amounts/rates retain the approved database constraints. A conservative bound may reject a safe heterogeneous population near extreme limits; it never silently clips an accepted bound. SUM supports 41 integer/24 fractional digits; AVG/median remain within the 37-integer-digit per-employee limit. The guard accepts the declared 10,000-person worst case and rejects a 10,001-person worst-case bound.

## Independent financial verification

Controlled fixtures run only in the existing isolated test schema. Expected responses are fixed literals from the following hand calculation, not computed by the production conversion/aggregation functions. UTC salary date is 2026-10-17. Current rates: USD=1, EUR=2, INR=3 units per USD.

| Employee | State / current original salary | Current USD | Counts by default |
|---|---|---:|---|
| A | Active, USD 0 | 0 | Employee and salary |
| B | Active, USD 100; old USD 20 and future USD 10,000 revisions | 100 | Once only |
| C | Active, EUR 100 | 50 | Employee and salary |
| D | Active, INR 300 | 100 | Employee and salary |
| E | Inactive, USD 50 | 50 | Neither; included only with explicit flag |
| F | Active future hire, future USD 900 | None | Employee/missing salary |
| G | Active, no salary record | None | Employee/missing salary |
| H | Active, future-only USD 800 | None | Employee/missing salary |

Default: employeeCount=7, salaryCount=4, missingSalaryCount=3. Sorted monetary values `[0,50,100,100]`: total **250.00**, average **62.50**, even median **75.00**, min **0.00**, max **100.00**. Boundaries `0,50,100` yield counts **[1,1,2]**. Include inactive: `[0,50,50,100,100]`, total **300.00**, average **60.00**, odd median **50.00**.

Independent cross-checks:

- Country totals **100.00 / 150.00**; department totals **150.00 / 100.00**; designation totals **100.00 / 50.00 / 100.00**. Combined filters and empty/no-current groups are tested.
- EUR reporting doubles USD equivalents: total **500.00**, median **150.00**.
- Earlier FX snapshot EUR=4, INR=6 gives **175.00** total, average **43.75**, median **37.50**. B stays at its current salary of 100, not its older salary of 20.
- Two EUR .01 salaries each convert to USD .005: total **.01**, average/median **.01** after half-up rounding. Both lie below the unrounded .01 bucket boundary.
- INR 1 plus retired-currency GBP 1 (GBP rate=2): total **.83**, average/median **.42**, extrema **.33/.50**.
- Maximum stored salary at maximum target/minimum source rates produces **9999999999999989999999990000000000000.01**; two salaries total **19999999999999979999999980000000000000.02**. Fixed expected strings were independently calculated with Python standard-library Decimal at precision 120. Real MySQL SUM, AVG, median and extrema match.
- Tiny cross-rate factor **0.000000000000000000000001** is preserved in metadata; values below computation/display resolution round consistently to zero while remaining counted salaries.
- UTC midnight changes current salary without writes; pooled precision reset is tested using a single-connection pool initially set to zero.

All these assertions passed against MySQL. Original development employees/salaries are not test fixtures.

## Commands and actual validation

Commands run from repository root; development data was not reseeded or migrated.

| Command | Result | Exit |
|---|---|---:|
| `npm test` | 5 files, 32 passed, 0 failed/skipped | 0 |
| `npm run test:db` | 3 files, 80 passed, 0 failed/skipped | 0 |
| `npm run typecheck` | Client/backend, including benchmark source, passed | 0 |
| `npm run lint` | Zero warnings/errors | 0 |
| `npm run build` | Client and backend passed | 0 |
| `npm run db:validate` | Prisma schema valid | 0 |
| `npm exec -w server -- tsx benchmarks/plan.ts` | Read-only EXPLAIN ANALYZE; plan verified | 0 |
| `PERF_DATABASE_NAME=salary_management_dev npm run bench:analytics` | Final workload/preservation passed; designation p95 misses target | 0 |
| `npm exec -w server -- tsx prisma/operations/verify-runtime.ts` | Runtime grants, counts, integrity and test cleanup verified | 0 |
| `docker inspect --format '{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}' salary-management-mysql` | Container memory/CPU caps: `0 0` | 0 |

**112 passing automated tests:** 71 existing plus 6 unit and 35 integration tests for this milestone. Final optimized-query integration duration: 4.89s. Final unit duration: 1.06s. Tests use the restricted runtime account; owners create and remove only isolated fixtures. No reset/truncate is used.

Intermediate outcomes: sandboxed database run failed setup (exit 1; 76 skipped, not passed); the authorized retry passed 76/76. Additional precision tests increased coverage to 80/80. The first performance run completed every request with zero HTTP errors but exited 1 while serializing bigint environment metadata; fixed before the final run. Initial full-workforce p95 values were 521.95/621.58/708.84/720.44 ms for summary/country/department/designation, respectively. That exploratory pass overlapped some validation/plan diagnostics, so it is not a controlled before/after speedup claim.

## Performance results

Final command: `PERF_DATABASE_NAME=salary_management_dev npm run bench:analytics` — **exit 0**, 7,000 measured requests, zero HTTP errors. Exit 0 means execution/preservation succeeded, **not** that every latency target passed. Raw timings and plan: [milestone-3-performance.json](milestone-3-performance.json).

| Case | p50 ms | p95 ms | Max ms | p95 <500 ms |
|---|---:|---:|---:|---|
| summary-usd | 281.52 | 395.92 | 574.04 | Yes |
| country-eur | 344.47 | 488.62 | 660.77 | Yes |
| department-usd | 366.35 | 491.10 | 739.75 | Yes |
| designation-inr | 375.28 | 500.02 | 785.30 | **No** |
| combined-filters | 19.59 | 31.68 | 90.90 | Yes |
| employee-late-page | 25.98 | 36.46 | 58.01 | Yes |
| employee-contains | 20.13 | 33.62 | 134.96 | Yes |

**The strict target is not met for all cases:** designation grouping measured 500.02 ms p95. Do not round that into a pass; country/department results also leave little margin. Further performance work remains open before a general latency claim.

Method: 1,000 requests per case at concurrency 10, after 20 sequential warmups; nearest-rank percentiles. Full HTTP round-trip includes session lookup, validation, SQL, serialization and response-body transfer. No concurrent tests/builds were run during this final pass. Requests were sequentially scheduled by case, not a mixed production workload. `coldMs` in JSON is the first request of each case (191.77 ms for the initial summary), **not** a cold database/buffer-pool measurement; snapshot reads and earlier work had warmed MySQL.

Environment: Apple M1, 8 logical CPUs, 8 GiB host RAM, macOS arm64; Node v24.20.0; MySQL 8.0.46 in local Docker via 127.0.0.1:3306. Container `HostConfig.Memory` and `NanoCpus` were both 0 (no explicit per-container cap); Docker Desktop VM limits and other host activity were not controlled. Strict SQL mode and division precision 4 were observed. Client/load generator and API share one Node process with loopback HTTP, without TLS, reverse proxy, internet latency, concurrent writers or a production login flow. Runtime session verification is included; password hashing/login time is not.

Dataset: **10,002 employees / 30,703 salary records**, including the two employees/three salaries from prior human manual testing. Snapshot SHA-256 comparison of all employee/salary/FX row fields passed before/after. Only the harness-created session was removed; no existing session was expired or deleted.

### Query costs and possible improvements

The final department EXPLAIN ANALYZE took approximately **133 ms** in a standalone execution (not the API percentile). It processed 9,601 eligible employees and 28,501 effective history rows, selected 9,501 current salaries and ranked 19,202 overall/group entries. Latest-date grouping materialized in about 34.5 ms; salary joins/conversion in about 69.9 ms; sorting, window buffering and aggregation account for the remainder. Numeric preflight performs a separate current-population query in the same transaction, adding work beyond this plan.

Existing designation/status and unique salary employee/date indexes are used. The applied SQL-only optimizations share converted rows and a named window. A candidate covering index on `(employee_id, effective_date, amount, currency_code)` could reduce salary table lookups, but duplicates part of the unique index and increases storage/write cost; it needs approval and measurement before any migration. An indexed latest-row lookup variant could also be benchmarked against grouped MAX, especially as history depth grows. Neither is claimed as a verified improvement or silently implemented. Cache/infrastructure changes remain outside this milestone.

### Final read-only database verification

`npm exec -w server -- tsx prisma/operations/verify-runtime.ts` exited 0. Counts: employees 10,002; salaries 30,703; departments 8; designations 24; countries 6; currencies 6; rates 12; users 1; sessions 1; inactive employees 401. Duplicate employee/date pairs, pre-hire salaries and negative salaries: **0**. All nine isolated test tables ended empty. Runtime salary UPDATE/DELETE remain denied (MySQL 1142); runtime/migration accounts remain separate. No reseed, migration, reset or existing workforce modification occurred.

## Files and boundaries

- Added `server/src/modules/analytics/{schemas,routes,service,repository,precision}.ts`, `server/test/analytics.test.ts`, `server/test/analytics.db.test.ts`, `server/benchmarks/{analytics,plan}.ts`, this evidence file, performance JSON and `prompts/007-milestone-3.md`.
- Updated `server/src/app.ts` to mount protected read endpoints, root/server package scripts and backend tsconfig to run/typecheck the harness, README, AI usage and decisions.
- No schema/migration/lockfile, runtime grants, frontend, CSV, deployment or dependency changes. No commit or push.

## Limitations and pending work

- Direct numeric-warning inspection is unavailable under the approved Prisma-only approach; conservative range checks and tested typed expressions are the documented alternative.
- Finite 24-place computations are not infinite rational arithmetic. Separately rounded group totals may differ from the rounded overall total by a cent.
- Current workforce only; reportingDate does not reconstruct historical headcount/assignments. Rates are illustrative, can be stale and never come from a live provider.
- Group cardinality is bounded by the seeded master data; group pagination is not implemented. No cache or speculative index changes were introduced.
- Designation-grouped analytics missed the strict p95 target at 500.02 ms; the general under-500-ms target is not fully achieved. Local performance does not establish production capacity. Production proxy/TLS, connection pool sizing and production load testing remain pending.
- Frontend dashboards, CSV import, browser/E2E analytics tests and deployment remain pending. Milestone 4 remains pending and requires a separate instruction to proceed.

Suggested commit: `feat: add salary analytics and decimal-safe currency reporting`.
