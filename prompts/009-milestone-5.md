# Milestone 5 — actual user prompt excerpts

> Proceed with Milestone 5 of the Employee Salary Management System.
> Treat approved requirements and API contracts as authoritative. If any detail is ambiguous or conflicts with existing behavior, ask before implementing.
> Maximum file size: 5 MiB. Maximum data rows: 10,000.
> Do not silently overwrite existing employee master data.
> Use appropriately scoped Prisma transactions. Each row's employee/salary changes must be atomic.
> A file-level parsing or structural failure should not leave unpredictable partial imports.
> Reimporting an identical CSV must not create duplicate employees or salary records.
> Add a CSV Import page to the existing React HR dashboard.
> Prevent CSV formula injection in generated downloadable error reports.
> Test CSV imports with representative datasets: 100 rows, 1,000 rows, 10,000 rows.
> Do not reset, truncate, or overwrite existing development data.
> Do not change the database schema without approval.
> Do not commit or push automatically.
> Stop after Milestone 5. Do not begin the next milestone without approval.

The full request also required bounded multipart/UTF-8 parsing, row-level validation and reference checks, quoted CSV support, authentication/Origin/CSRF reuse, concurrent import testing, partial-success/error downloads, actual timing/memory evidence and documentation. Existing approved contracts resolve employee status: there is no CSV status field; new employees are active and existing status remains unchanged.
