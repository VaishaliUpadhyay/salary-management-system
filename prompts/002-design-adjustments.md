# Actual user prompt — design adjustments, 2026-10-15

I've reviewed the technical design. Please make these final adjustments:

1. Reject salary effective dates earlier than the employee's hire date, while allowing future hire dates and future salary revisions.
2. Reject new salary revisions for inactive employees, but preserve their history.
3. Verify that the proposed MySQL DECIMAL conversion calculations are technically valid and document any necessary changes.
4. Keep the CSV import design, but explicitly identify synchronous import timeout risks.
5. Keep authentication secure but avoid unnecessary abstractions.

Update database-design.md, api-contracts.md, architecture.md, and decisions.md consistently.

Do not implement application code yet. Summarize the changes and any remaining decisions requiring my approval.
