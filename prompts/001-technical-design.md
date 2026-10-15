# Actual user prompt — technical design, 2026-10-15

> We are building the Employee Salary Management System for HR as take-home assessment.
>
> First, read:
>
> - AGENTS.md
> - docs/requirements.md
> - docs/assessment/assessment.docx (if accessible)
>
> The requirements and architecture decisions are already finalized at the product level.
>
> Your first task is **technical design only**.
>
> 1. Design a normalized MySQL 8.x schema using Prisma.
> 2. Define tables, columns, relationships, foreign keys, unique constraints, and indexes.
> 3. Explain how current, historical, and future-dated salaries will be queried efficiently.
> 4. Design REST API contracts for employee management, salary revisions, analytics, CSV import, authentication, and currency reporting.
> 5. Identify edge cases and ambiguities, especially salary effective dates, CSV idempotency, currency rates, and analytics.
> 6. Propose the simplest maintainable architecture.
> 7. Write the results into docs/database-design.md, docs/api-contracts.md, and docs/architecture.md.
> 8. Record major decisions and trade-offs in docs/decisions.md.
>
> Constraints:
>
> - Do not write application code.
> - Do not install dependencies.
> - Do not run database migrations.
> - Do not change the selected stack.
> - Do not commit or push changes.
> - Ask for clarification when a requirement is genuinely ambiguous.
>
> At the end, summarize the design, identify risks, and explain what I should review before implementation.

## Actual clarification exchange

Assistant: “For CSV rows matching an existing employee, should imports leave employee master fields unchanged (reject mismatches and require editing the employee first), or update name, email, country, designation, and hire date when adding a new salary revision?”

User: “Keep master fields unchanged; reject mismatches”
