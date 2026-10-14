# Architecture Decisions — Salary Management System

1. **Database:** MySQL 8.x instead of PostgreSQL due to familiarity and time constraints.
2. **Normalization:** Separate `departments`, `designations`, `countries`, and `employees` tables to avoid duplication and maintain data consistency.
3. **Relationships:** Use foreign keys (`departments → designations → employees → salary_records`) to enforce referential integrity.
4. **Salary History:** Use one append-only `salary_records` table to preserve revisions without overwriting historical data.
5. **Authentication:** Single authenticated HR Manager to keep the MVP secure without complex role management.
6. **Currency Conversion:** Use seeded/cached exchange rates instead of live APIs for deterministic, reliable reporting.
7. **Scope:** Exclude payroll, taxes, payslips, and approval workflows to focus on compensation management and analytics.
8. **Scalability:** Use indexed MySQL queries, server-side pagination, and database aggregation to support 10,000 employees.