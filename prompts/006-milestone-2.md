# Actual user prompt — Milestone 2

Milestone 1 is complete, reviewed, and committed.

Proceed with **Milestone 2: Employee Management and Salary Management Backend APIs**.

Before implementing anything, read:

- AGENTS.md
- docs/requirements.md
- docs/architecture.md
- docs/database-design.md
- docs/api-contracts.md
- docs/decisions.md
- docs/ai-usage.md

Follow the approved architecture and API contracts. Do not introduce new features or change the database schema without asking.

### Tasks

**1. Database security**

- Configure and verify a restricted MySQL runtime user using the approved runtime-role.sql.
- Ensure the running application uses restricted DATABASE_URL credentials and migration commands use MIGRATION_DATABASE_URL.
- Verify salary UPDATE/DELETE privileges are denied.
- Never expose credentials or reset the existing database.

**2. Employee management APIs**

- Create employee.
- List employees with server-side pagination, search by name, and filters for country, department, designation, and status.
- Get employee details.
- Update employee master information.
- Deactivate employees using soft deletion.
- Exclude inactive employees by default.

**3. Salary management APIs**

- Add annual base salary revisions using append-only records.
- Retrieve complete salary history for an employee.
- Retrieve current and future-dated salary records separately.
- Reject salary revisions before the employee's hire date.
- Reject new revisions for inactive employees.
- Prevent hire-date changes that invalidate existing salary history.
- Enforce unique employee/effective-date combinations.
- Preserve original salary amounts and currencies.

**4. Validation and reliability**

- Implement Zod request validation.
- Use Prisma transactions where necessary.
- Handle database constraint errors and return consistent API error responses.
- Prevent race conditions involving concurrent salary revisions and employee deactivation.
- Use database-level pagination and appropriate indexes.

**5. Authentication**

- Implement the approved single HR Manager login, logout, and session validation.
- Protect all employee and salary endpoints.
- Use HttpOnly session cookies, secure production cookie settings, CSRF/origin protection, and login rate limiting.
- Follow the approved authentication design without introducing additional roles.

**6. Automated testing**
Write and execute tests covering:

- Authentication and unauthorized requests.
- Employee CRUD and filtering.
- Employee deactivation.
- Salary history and current/future classification.
- Duplicate salary effective dates.
- Pre-hire salary rejection.
- Inactive employee salary rejection.
- Hire-date validation.
- Concurrent modification scenarios.
- Database permission restrictions.

Use the existing isolated test database. Do not modify or reset the seeded development data.

**7. Documentation**

- Update README.md only where necessary.
- Update docs/ai-usage.md.
- Record the implementation and actual validation results in docs/milestone-2.md.

### Important restrictions

- Do not implement frontend screens, analytics, currency conversion reporting, or CSV import yet.
- Do not modify the approved architecture without approval.
- Do not reset, truncate, or overwrite the existing seeded database.
- Do not commit or push automatically.
- Do not deploy.

### Completion report

Provide:

1. Files created or modified.
2. API endpoints implemented.
3. Commands executed.
4. Actual test results and exit codes.
5. Database security verification results.
6. Remaining limitations.
7. Suggested Git commit message.

If any important requirement is ambiguous, ask before implementing.
