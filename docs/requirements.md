# Salary Management Sytem — MVP Requirements

**Goal:** Build a web-based compensation management system enabling HR Manager's to maintain salary records for 10,000 employees across multiple countries and analyze how the organization pays its workforce.

**Primary user:** HR Manager. The MVP supports one authenticated HR account.

### 1. Key Business Questions

The application must help HR answer:

1. How do salaries differ by department, designation, and country?
2. What are the employee count, average, median, minimum, and maximum annual base salaries for a selected group?
3. How are salaries distributed across pay ranges?
4. What is an employee's complete salary revision history?
5. How much does the organization spend on annual base salaries, by department and country?

### 2. Functional Scope

| ID | Feature | Requirements |
|---|---|---|
| F1 | Employee Management | Create, view, edit, search, filter, and deactivate employees. Maintain unique employee ID, name, email, country, department, designation, hire date, and status. |
| F2 | Organization Structure | Manage departments and their associated designations through relational database records. Enforce valid department/designation relationships. |
| F3 | Salary Management | Maintain annual base salary, currency, and effective date. Every revision creates a historical record. Display current and future-dated compensation separately. |
| F4 | Compensation Analytics | Display employee count, annual base-pay totals, average, median, minimum, maximum, and salary distribution. Support filtering and grouping by country, department, and designation. |
| F5 | Multicurrency Reporting | Preserve original salary and currency. Convert salaries into a selectable reporting currency using cached exchange rates with source and date displayed. |
| F6 | CSV Import | Import employees and salary records with required-field validation, duplicate detection, idempotent handling, and row-level error reports. |
| F7 | Authentication | Secure HR login/logout, password hashing, protected API routes, and session validation. |
| F8 | Scalability | Deterministically seed 10,000 realistic employees. Support server-side pagination, filtering, and database-side analytics. |

### 3. Business Rules

- Employee IDs and department/designation relationships must remain valid and unique where applicable.
- Salaries are non-negative decimal values with explicit ISO currency codes.
- Salary revisions are append-only, with one revision per employee per effective date. Current salary is the latest effective revision as of today.
- Future-dated revisions do not affect current salary until their effective date.
- Original salaries are never overwritten by currency conversion; cross-currency totals use a common reporting currency and dated exchange rates.
- CSV imports reject conflicting records, skip unchanged records, and report invalid rows without silently discarding them.
- Deactivated employees retain their salary history and are excluded from active-workforce analytics by default.

### 4. Non-Functional Requirements

- **Database:** MySQL 8.x with foreign keys, indexes, decimal monetary values, and transactions.
- **Performance:** Target p95 API latency below 500 ms for common queries against 10,000 employees in a documented test environment.
- **Security:** Protected compensation endpoints, validated inputs, hashed passwords, and secure authentication cookies.
- **Quality:** Deterministic unit and API tests covering salary revisions, import rules, currency conversion, authentication, and analytics.

### 5. Deliberately Out of Scope

- Payroll processing, taxation, payslips, and bank transfers — separate payroll responsibilities.
- Salary approval workflows, benefits, equity, and performance reviews — beyond core compensation management.
- Multi-user administration and advanced role permissions — one HR user in the MVP.
- Automated correction of historical salary records and full audit-log management — deferred to a later version.
- Excel-native XLSX support and report exports — CSV import prioritized for migration.

### 6. Assumptions and Delivery

- Compensation means annual base salary, not CTC or net take-home pay.
- Country and currency are separate attributes; currencies may change through salary revisions.
- Exchange-rate data is cached; reports identify the conversion date and do not claim purchasing-power equivalence.
- The deployed demonstration uses synthetic employee and salary data.

**Technology:** React + TypeScript, Node.js + Express + TypeScript, Prisma ORM, MySQL 8.x.

**Deliverables:** Fully functional deployed application, 10,000-employee seed script, automated tests, video demonstration, Git repository with incremental commits, requirements document, architecture notes, trade-off explanations, and AI prompt history.

**Success Criteria:** HR can securely manage employee records, revise salaries, inspect complete histories, import CSV data, and answer the defined compensation questions through responsive analytics.