# Milestone 3 — actual user prompt excerpts and clarification

The following are verbatim excerpts from the implementation request (omitted sections specify the analytics tests and completion report):

> Milestone 2 is complete, manually verified, and committed.
>
> Proceed with **Milestone 3: Salary Analytics, Reporting, and Currency Conversion**.
>
> Follow the approved architecture, API contracts, and business rules. Do not introduce unapproved changes.
>
> Follow the approved policy that the reporting date selects the exchange-rate snapshot, not a historical employee/salary snapshot.
>
> Create a small, controlled test dataset with manually calculated expected results.
>
> Do not derive expected results using the same implementation logic being tested.
>
> Do not modify or reset existing development data for performance testing.
>
> Do not begin Milestone 4 until Milestone 3 has been reviewed and approved.

Actual clarification asked:

> The approved design flags a MySQL limitation: Prisma cannot read SELECT numeric warnings because MySQL does not prepare diagnostic statements. May I keep Prisma and add conservative range checks before calculation, verify DECIMAL/session settings, and reject unsafe reports with REPORT_NUMERIC_RANGE_EXCEEDED? This avoids a new driver or schema change, but cannot inspect warning messages directly.

User answer:

> Use Prisma with range checks
