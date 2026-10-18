# Database design — approved design

Approved by the user for Milestone 1 on 2026-10-15. The design-stage descriptions below are preserved; implementation evidence and remaining live checks are tracked in [milestone-1.md](milestone-1.md).

Technical design only, 2026-10-15. Product authority: [requirements](requirements.md), then [AGENTS.md](../AGENTS.md). No migrations or application schema have been created. The assessment was read from `docs/assessment/assessment.docx`; it introduces no conflicting requirements.

**Current status:** Milestones 1–5 are implemented and user-confirmed complete. The design-stage wording below is historical; use [Milestone 6](milestone-6.md) for executed checks and outstanding delivery gaps, and [setup](setup.md) for fresh local installation. The approved Prisma range-check decision in [decisions](decisions.md) supersedes direct SELECT-warning inspection. The checked-in Prisma schema and initial migration are implemented; no schema changes were made during final QA.

## Conventions

Use MySQL 8.x InnoDB, minimum 8.0.16 for enforced CHECK constraints. Pin the exact supported MySQL and Prisma versions during implementation. All columns are NOT NULL unless marked `?`. IDs are unsigned auto-increment INTs; expose them as JSON numbers. Employee business identifiers are separate immutable `employeeCode` strings. Table/column names are snake_case through Prisma `@@map`/`@map`.

Calendar dates use MySQL DATE / Prisma `DateTime @db.Date`; timestamps use UTC DATETIME(3). Capture UTC today once per request and bind it to every query. Parse and serialize dates as validated `YYYY-MM-DD`, translating Prisma Date objects through UTC only. Do not derive today from the database host timezone.

Amounts are `Decimal @db.Decimal(15,2)`; API money is a decimal string. Normalize identifiers to trimmed uppercase ASCII; names are trimmed Unicode. Use utf8mb4 for text, case-insensitive name uniqueness, and explicit binary/ASCII collation for normalized codes in migrations. Email is trimmed/lowercased by policy, not unique for employees; HR login email is unique. Never use email as import identity.

## Prisma model specification

This is a declarative schema specification for the future Prisma file, not application code. Each row specifies every scalar column. Collections and relationship fields below are additional Prisma relation fields, not database columns.

| Prisma model / SQL table | Scalar fields (Prisma type, native type, constraints/defaults) |
|---|---|
| Department / departments | `id Int @id @default(autoincrement()) @db.UnsignedInt`; `code String @unique @db.VarChar(30)`; `name String @unique @db.VarChar(100)`; `isActive Boolean @default(true)`; `createdAt DateTime @default(now()) @db.DateTime(3)`; `updatedAt DateTime @updatedAt @db.DateTime(3)` |
| Designation / designations | `id Int @id @default(autoincrement()) @db.UnsignedInt`; `departmentId Int @db.UnsignedInt`; `code String @unique @db.VarChar(30)`; `name String @db.VarChar(100)`; `isActive Boolean @default(true)`; `createdAt DateTime @default(now()) @db.DateTime(3)`; `updatedAt DateTime @updatedAt @db.DateTime(3)` |
| Country / countries | `id Int @id @default(autoincrement()) @db.UnsignedInt`; `code String @unique @db.Char(2)` (ISO 3166-1 alpha-2); `name String @unique @db.VarChar(100)`; `isActive Boolean @default(true)`; `createdAt DateTime @default(now()) @db.DateTime(3)`; `updatedAt DateTime @updatedAt @db.DateTime(3)` |
| Currency / currencies | `code String @id @db.Char(3)` (supported ISO 4217 code); `name String @db.VarChar(100)`; `isActive Boolean @default(true)` |
| Employee / employees | `id Int @id @default(autoincrement()) @db.UnsignedInt`; `employeeCode String @unique @db.VarChar(50)`; `name String @db.VarChar(150)`; `email String @db.VarChar(254)`; `designationId Int @db.UnsignedInt`; `countryId Int @db.UnsignedInt`; `hireDate DateTime @db.Date`; `isActive Boolean @default(true)`; `createdAt DateTime @default(now()) @db.DateTime(3)`; `updatedAt DateTime @updatedAt @db.DateTime(3)` |
| SalaryRecord / salary_records | `id Int @id @default(autoincrement()) @db.UnsignedInt`; `employeeId Int @db.UnsignedInt`; `amount Decimal @db.Decimal(15,2)`; `currencyCode String @db.Char(3)`; `effectiveDate DateTime @db.Date`; `createdBy Int @db.UnsignedInt`; `createdAt DateTime @default(now()) @db.DateTime(3)` |
| ExchangeRate / exchange_rates | `id Int @id @default(autoincrement()) @db.UnsignedInt`; `currencyCode String @db.Char(3)`; `effectiveDate DateTime @db.Date`; `unitsPerUsd Decimal @db.Decimal(24,12)`; `source String @db.VarChar(200)`; `createdAt DateTime @default(now()) @db.DateTime(3)` |
| User / users | `id Int @id @default(autoincrement()) @db.UnsignedInt`; `email String @unique @db.VarChar(254)`; `passwordHash String @db.VarChar(255)`; `createdAt DateTime @default(now()) @db.DateTime(3)` |
| Session / sessions | `id Int @id @default(autoincrement()) @db.UnsignedInt`; `tokenHash String @unique @db.Char(64)`; `userId Int @db.UnsignedInt`; `csrfToken String @db.Char(64)`; `createdAt DateTime @default(now()) @db.DateTime(3)`; `expiresAt DateTime @db.DateTime(3)` |

`createdBy` is required, including on imports and synthetic seed salaries (seed HR user). No salary updated timestamp exists because rows are immutable. A small currency lookup enforces supported codes without coupling country and currency. Currency/rate maintenance is seed/operator-only; it is not a live-rate service or extra admin UI. USD has dated seeded rows with rate exactly 1.

## Relations and integrity

All relations use Prisma `@relation(fields: [foreignKey], references: [id or code], onDelete: Restrict, onUpdate: Restrict)`. Use actual database foreign keys, not Prisma-emulated integrity. Referenced IDs/codes are immutable.

| Child field → parent | Prisma child relation / parent collection |
|---|---|
| designations.department_id → departments.id | `department / designations` |
| employees.designation_id → designations.id | `designation / employees` |
| employees.country_id → countries.id | `country / employees` |
| salary_records.employee_id → employees.id | `employee / salaryRecords` |
| salary_records.currency_code → currencies.code | `currency / salaryRecords` |
| salary_records.created_by → users.id | `creator / salaryRecords` |
| exchange_rates.currency_code → currencies.code | `currency / exchangeRates` |
| sessions.user_id → users.id | `user / sessions` |

Employees have neither department_id nor current salary. A designation belongs to exactly one immutable department; changing an employee designation changes the derived department. Renaming master records affects all current displays, including labels beside past salary records; no organizational history is claimed.

Additional Prisma declarations:

| Table | Unique / index declarations | Purpose |
|---|---|---|
| designations | `@@unique([departmentId, name])` | Department-scoped names; department lookup via leading index column |
| employees | `@@index([isActive, id])`; `@@index([countryId, isActive, id])`; `@@index([designationId, isActive, id])`; `@@index([name, id])` | Status, country, designation/department filtering; name sorting/prefix search |
| salary_records | `@@unique([employeeId, effectiveDate])`; `@@index([currencyCode])`; `@@index([createdBy])` | Latest revision, history, date conflict and FK coverage |
| exchange_rates | `@@unique([currencyCode, effectiveDate])` | Latest nonfuture rate per currency; one canonical source per date |
| sessions | `@@index([userId])`; `@@index([expiresAt])` | User sessions and expired session cleanup |

Primary keys and scalar `@unique` declarations also create indexes. No speculative indexes on amount or every field combination; inspect query plans first. Contains search across employee code/name/email may scan the filtered 10,000-row set; do not claim a B-tree optimizes leading-wildcard searches.

Future migrations must add named CHECK constraints for salary amount >= 0, rate > 0 and USD rate = 1. Zod validates lengths, actual calendar dates, supported codes, input precision, and active master assignments before writes; FK/unique/CHECK constraints remain the race-safe final authority. CHECK details and collations require migration SQL rather than assuming Prisma schema syntax covers everything. The application DB role must have SELECT/INSERT but no UPDATE/DELETE on salary_records; migration credentials remain separate. No employee/master hard-delete endpoints. Sessions alone are routinely deleted.

## Salary query strategy

Let T be the request's UTC date. For employee E, current salary is the row with maximum effective_date <= T. The unique `(employee_id, effective_date)` index supports an ordered range lookup descending with LIMIT 1. Future rows have date > T, ascending; historical rows have date < current.effective_date, descending. With future-only revisions, current is null, history is empty, future is populated. A zero amount is a valid current salary, not absence.

Employee list: apply employee/master filters and deterministic ordering, page employee IDs in SQL, then fetch current rows for those IDs in one batched query. Avoid one query per employee. Detail fetches current plus the earliest future revision; complete history/future lists are separately paginated.

Analytics query pipeline (parameterized SQL via Prisma):

1. Select eligible employee IDs using current status/country/designation/derived department.
2. For those IDs only, group salary_records where effective_date <= T by employee_id and select MAX(effective_date). Join back on the unique pair to obtain exactly one current salary per employee. LEFT JOIN eligible employees so no-current employees remain counted.
3. Select each required rate by MAX(effective_date) <= reportingDate, join on `(currency_code, effective_date)`, and verify coverage before returning monetary results.
4. Convert each current salary, then aggregate in SQL. Use a CTE with ROW_NUMBER ordered by converted amount and employee_id and COUNT OVER partitioned by group. Median averages positions FLOOR((n+1)/2) and FLOOR((n+2)/2); odd n selects one row. SUM/AVG/MIN/MAX and distribution counts operate on that same converted population.

Use one statement where practical; multiple statements for summary, groups, buckets and coverage use a short consistent read transaction. Never aggregate all revisions or transfer 10,000 salaries into Node/browser to calculate median. The salary index supports both lookup and grouped selection; benchmark actual plans before choosing a window-based alternative. Future salaries become current through date predicates without a scheduled mutation.

## Conversion and analytics definitions

Rate direction: `unitsPerUsd(C)` = units of C per 1 USD. Conversion A → B is `amount / rate(A) * rate(B)`. Same-currency conversion is exactly 1 and requires no rate. Any USD leg uses the dated USD row (1) so provenance remains explicit. Select each currency's latest available rate on/before reportingDate independently; disclose both dates/sources, which may differ. No future rates, invented parity, live calls, or automatic age cutoff. Show age and illustrative status.

The previous DECIMAL(50,20) factor / DECIMAL(60,20) proposal used valid types but did not specify division precision and could turn very small valid factors into zero. Replace it with direct multiply-then-divide conversion, without multiplying salaries by a rounded display factor. MySQL permits at most 65 total digits and 30 fractional digits. Exact division's scale depends on the numerator scale plus `div_precision_increment` (default 4); an outer cast cannot recover discarded digits. These rules were checked against the official documentation, not a running database.

The proposed SQL expression below is a design illustration, not application code:

```sql
CAST(
  CAST(amount * target_rate AS DECIMAL(49,24)) / source_rate
  AS DECIMAL(65,24)
)
```

Here amount is DECIMAL(15,2), and both rates are DECIMAL(24,12). Require `@@session.div_precision_increment = 4` on every reporting connection (verify pooled-connection configuration; do not assume a one-off SET applies to the pool). The product is DECIMAL(39,14), with at most 25 integer digits. Widening it to DECIMAL(49,24) loses nothing. Division then has scale 28 and up to 65 total digits; the final cast retains 24 fractional digits and 41 integer digits. Same-currency values bypass division and cast the original amount to DECIMAL(65,24).

Range reasoning from the declared columns: amount < 10^13, positive rate >= 10^-12 and < 10^12, so a converted employee amount is < 10^37. A total for 10,000 employees is < 10^41 and fits DECIMAL(65,24). This is a range proof for the target dataset, not an unbounded-workforce guarantee. SUM/AVG on exact operands return DECIMAL; use AVG of the middle one/two rows for median and avoid summing into a smaller intermediate type. Validate aggregate result types and extreme-value behavior on pinned MySQL before implementation acceptance. Report SQL numeric overflow/invalid numeric warnings as `REPORT_NUMERIC_RANGE_EXCEEDED`; never return a clipped value. Strict SQL mode alone is not a guarantee that every SELECT cast warning becomes an error.

The 28-place division and 24-place converted values are explicit finite computation boundaries, not per-employee cent rounding. Bucket/rank operations use the 24-place values. A displayed cross-rate factor may be computed separately to 30 fractional places (cast target rate to DECIMAL(42,30) before division), but is informational and must never drive salary calculations. Tiny amounts can round to zero at the computation boundary; no promise of infinite rational precision is made. Test repeating ratios and values near cent/bucket boundaries. Final monetary output rounds half-up to two decimals only after aggregation, including average/median. Display two decimals consistently because the product stores base salaries to two decimals, even for currencies with different customary minor units. Never convert through JavaScript Number; charts may use bounded approximate display coordinates while exact labels remain strings.

EmployeeCount includes all eligible employees. SalaryCount counts those with a current salary; missingSalaryCount is their difference. No-current salaries contribute neither zero nor null to salary statistics. Empty salary population: total `"0.00"`, average/median/min/max null, buckets zero. Missing required rates: monetary report fails explicitly, never returns a subtotal as a complete total. Zero salaries still require rates when cross-currency reporting.

Only current compensation analytics are in scope: salaryAsOfDate is always UTC today. reportingDate defaults to today and may be an earlier date solely for FX selection, never a historical workforce snapshot. Reject future reportingDate. Group by current master assignments/status. Details and revision lists preserve original currency amounts.

## Transactions and lifecycle

Employee creation and its initial revision are atomic. Salary insertion and CSV rows lock the existing employee row where relevant to serialize with deactivation/master edits; the unique revision constraint resolves competing same-date writes. Employee deactivation retains all revisions and can coexist with future revisions; new salary revisions for inactive employees are rejected, including backdated and future revisions. Existing historical/current/future records remain unchanged and readable; already-scheduled records still classify by date, but default analytics excludes the inactive employee. Master retirement prevents new assignments but does not invalidate existing references. Re-enabling a master is allowed. Employee reactivation is not an MVP endpoint.

User-confirmed refinement (2026-10-15): every newly inserted salary must have effectiveDate >= employee.hireDate; equality is valid. Future hire dates and future salary revisions remain allowed. For a future hire, the initial salary must be on/after that future hire date, so there is no current salary yet. Status still controls workforce eligibility; an active future hire counts in employeeCount and missingSalaryCount until a salary takes effect.

Reject a hireDate edit later than MIN(effective_date) across **all** of that employee's existing revisions, including scheduled revisions; this prevents edits from invalidating preserved history. The check, date/status validation and salary insertion run in transactions that lock the employee row. Deactivation and hire-date edits acquire the same lock, so concurrent writes cannot bypass the rules. If insertion commits before deactivation, the inserted row is retained; if deactivation commits first, insertion fails. These cross-table rules cannot be expressed as a simple MySQL CHECK; enforce in the shared salary/employee services used by manual and CSV writes. Seed fixtures must obey them too (create salaries before marking seed employees inactive).

CSV replay of an identical existing record remains a no-write skip even if the employee is now inactive. A new-date row for that employee is rejected. The full CSV ordering and error precedence are in the API contract.

## Validation to perform during implementation

Real MySQL integration tests must verify FK restrictions, CHECK enforcement, unique races, rollback, date round-trips across timezones, case normalization, pre-hire/equal-hire/future-hire dates, inactive insertion and deactivation races, hire-date edits against earliest revision, DECIMAL extrema and reporting-connection precision settings, odd/even median, no-current/zero salaries and missing rates. Prisma validation and migration review are deferred until implementation approval. No latency claim is made.

Numeric verification references: [MySQL DECIMAL limits](https://dev.mysql.com/doc/refman/8.0/en/precision-math-decimal-characteristics.html), [arithmetic and division scale](https://dev.mysql.com/doc/refman/8.0/en/arithmetic-functions.html), [exact-value aggregates](https://dev.mysql.com/doc/refman/8.0/en/aggregate-functions.html), [rounding behavior](https://dev.mysql.com/doc/refman/8.0/en/precision-math-rounding.html). Runtime verification is deferred; no SQL was executed in this design revision.

References: [Prisma MySQL native mappings](https://docs.prisma.io/docs/orm/v6/overview/databases/mysql), [Prisma schema reference](https://docs.prisma.io/docs/orm/reference/prisma-schema-reference), [MySQL CTE documentation](https://dev.mysql.com/doc/refman/8.0/en/with.html), [MySQL 8.0 reference manual](https://dev.mysql.com/doc/refman/8.0/en/). These support type/query choices; versions must be pinned and generated SQL verified later.


## Milestone 1 live verification note

Initial migration and seed validated on MySQL 8.0.46; see [milestone-1.md](milestone-1.md). The basic and maximum-input conversion expressions returned expected results. MySQL does not prepare SHOW WARNINGS or references to @@warning_count, so reporting cannot rely on those statements through Prisma `$queryRaw`. A separate native-client basic conversion check had zero warnings. Decide and validate the reporting error/range-handling implementation during the analytics milestone; no alternate driver or architecture change has been introduced here.
