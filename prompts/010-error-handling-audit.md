# Project-Wide Audit — User-Friendly Error Messages and Consistent Error Handling

The Employee Salary Management System is functionally complete through Milestone 5.

During manual testing, I noticed that several frontend screens display technical error messages directly from the backend.

For example:

**Request validation failed**
- bucketBoundaries: Boundaries must start at zero and strictly increase
- Reference: 1d193530-d4bf-41f9-8a23-aebec9a02957

Similar issues may exist across authentication, employee management, salary management, analytics, reporting, CSV import, and general API failures.

I want a comprehensive audit and improvement of error handling throughout the application.

## 1. Audit the entire project

Inspect:

- Frontend API client and error-handling utilities.
- Backend error middleware and response formatting.
- Zod validation errors.
- Prisma/database errors.
- Authentication and session errors.
- Employee creation, editing, and deactivation.
- Salary revision forms.
- Analytics and reporting endpoints.
- Currency conversion.
- CSV import and error reporting.
- Loading and network failure states.

Identify every place where technical errors can reach the frontend.

Do not limit the audit to the examples above.

## 2. Establish consistent user-facing error messages

Use a consistent structure:

- Clear, user-friendly title.
- Simple explanation of the problem.
- Actionable guidance explaining how to fix it, where possible.
- Relevant field names using human-readable labels.

Examples:

Instead of:
"Request validation failed"

Use:
"Please check the information you entered."

Instead of:
"bucketBoundaries: Boundaries must start at zero and strictly increase"

Use:
"Salary ranges must start at 0, and each subsequent value must be greater than the previous one."

Instead of:
"UNKNOWN_REFERENCE"

Use:
"The selected value is not available. Please choose another option."

Instead of:
"INVALID_AMOUNT"

Use:
"Enter a valid non-negative salary amount with no more than two decimal places."

Instead of:
"ORIGIN_REJECTED"

Use:
"We couldn't complete your request. Please refresh the page and try again."

Ensure the messages accurately reflect the actual problem. Do not show misleading advice.

## 3. Centralize error presentation

Create or improve a shared frontend error-handling layer.

Requirements:

- Use structured backend error codes and field information.
- Map known errors to appropriate user-facing messages.
- Avoid duplicating error-message logic across components.
- Do not rely on fragile string matching of backend messages.
- Do not expose raw Zod messages, regex patterns, SQL errors, Prisma errors, stack traces, or internal identifiers.
- Preserve machine-readable error codes and request IDs for debugging.
- Use human-readable labels for fields.
- Support multiple validation errors in a single response.

Where appropriate, improve backend validation messages without breaking existing API contracts.

## 4. Use the correct UI presentation

Choose the appropriate error presentation based on context:

- Field validation errors: display beneath the relevant form input.
- Multiple validation errors: display a clear summary and field-level guidance.
- API failures: display a readable alert.
- Successful operations: use success notifications.
- Network errors: explain that the connection failed and offer retry guidance.
- Session expiration: explain that the user needs to log in again.
- Permission errors: explain that the action is unavailable.
- CSV import errors: preserve row numbers and readable field labels.
- Analytics errors: explain invalid filters, reporting currency issues, and missing exchange rates.

Do not display generic "Something went wrong" messages when more specific, reliable guidance is available.

## 5. Handle unexpected errors safely

For unexpected server failures:

Display:
"We couldn't complete your request. Please try again."

Keep the request/reference ID available in a secondary troubleshooting section, such as:

"Technical reference: [request ID]"

Do not expose internal database details or stack traces.

Ensure server-side logs retain enough diagnostic information for troubleshooting without leaking sensitive data.

## 6. Prevent avoidable validation errors

Review forms and controls to ensure users cannot easily submit invalid values.

Examples:

- Salary range boundaries should be validated before API submission.
- Currency selectors should use supported currencies.
- Designation options should match the selected department.
- Required fields should be clearly identified.
- Salary amounts should be validated before submission.
- Dates should use consistent formats.

Frontend validation must improve UX, but backend validation must remain authoritative.

Do not silently modify user inputs or weaken existing validation rules.

## 7. Preserve compatibility and security

- Do not change existing business rules.
- Do not modify the database schema.
- Do not break API response contracts.
- Do not expose internal technical details.
- Do not weaken authentication, CSRF, Origin checks, or rate limiting.
- Do not introduce unnecessary dependencies.
- Do not change unrelated application functionality.

## 8. Automated testing

Add or update tests covering:

1. Known validation errors.
2. Multiple field errors.
3. Unknown backend errors.
4. Network failures.
5. Authentication failures.
6. Expired sessions.
7. Rate limiting.
8. Employee and salary validation.
9. Analytics filter validation.
10. Missing FX rates.
11. CSV row-level validation.
12. Reference ID handling.
13. Error presentation and accessibility.

Verify that technical messages never appear in the primary user-facing UI.

Run all relevant tests, lint, typecheck, and production builds.

## 9. Documentation and completion report

Update the relevant documentation, including docs/ai-usage.md.

Provide:

1. A summary of error-handling issues discovered.
2. Components and backend services updated.
3. Examples of old versus new error messages.
4. Tests added or updated.
5. Actual test results.
6. Remaining limitations.

Do not reset or modify existing development data.

Do not commit or push automatically.

Complete this error-handling improvement before continuing with other Milestone 6 tasks.