# Development database cleanup — approval pending

This is a one-off operator maintenance operation requested after Milestone 5, not an application deletion feature. No cleanup has been executed. No database records were changed during inspection or backup.

## Actual dry-run results

Database: `salary_management_dev` (local Docker MySQL). Inspection and backup performed on 2026-10-18 local time.

| Measure | Actual count |
|---|---:|
| Current employees, including inactive | 21,114 |
| Verified original seeded employees | 10,000 |
| Current salary records | 41,816 |
| Original deterministic salary records verified | 30,700 |
| All salaries to preserve for seeded employees | 30,701 |
| Proposed employee removals, subject to approval below | 11,114 |
| Related proposed salary removals | 11,115 |
| Expected remaining employees | 10,000 |
| Expected remaining salary records | 30,701 |
| Missing seed employee codes / mismatched original salaries | 0 / 0 |

The pure `buildSeedData()` function defines the exact employee-code set `EMP00001`–`EMP10000`. Inspection joined by these business codes, then verified every generated baseline effective-date/amount/currency tuple against the associated actual employee ID. It did not classify records using numerical primary-key thresholds. All original salary tuples are present. One additional salary belongs to a seeded employee and is preserved.

`EMP00001` differs from its initial employee master fixture. That employee and its current master fields remain untouched. No seed restoration or master-data updates are proposed.

## Candidate classification and ambiguity

| Candidate group | Employees | Salaries | Evidence |
|---|---:|---:|---|
| `M5TEST…` | 11,112 | 11,112 | Explicit test-prefixed codes, outside the complete deterministic seed set |
| `EMP000` | 1 | 1 | Non-seed code; created 2026-10-17 00:44:35.351 UTC |
| `EMP010010` | 1 | 2 | Non-seed code; created 2026-10-17 00:55:15.404 UTC |

There are **zero ambiguous seed memberships**, but **two records with ambiguous test purpose**: `EMP000` and `EMP010010`. Their names/emails are not exposed in this report. The schema has no creation-source or import audit field, so manual versus CSV provenance cannot be proven for any group from database records alone. Test prefixes are supporting evidence, not an audit trail.

Approval must explicitly confirm that all 11,112 `M5TEST…` employees and the two named non-seed employees are disposable test records. Without confirmation of the two named records, removing only the test-prefixed group would leave 10,002 employees. The private manifest enumerates every proposed ID/code pair for review; it is not blanket permission to delete all future non-seed employees.

## Backup already created

Private, Git-ignored file: `.local-db-cleanup/backup-1792305169118.sql`.

- Size: **5,823,445 bytes**.
- SHA-256: `1b644beeeb71a01d331cc09bec051f0308a5db8d2c81884539294cd586554ded`.
- Matching `.receipt.json` records path, bytes, and checksum.
- Directory permissions: owner-only; dump and manifest permissions verified as `0600`.
- MySQL `mysqldump` exited 0; completion marker and employee/salary table definitions verified.
- Full database dump includes authentication data; keep it private. It is not a server-wide users/grants backup.
- **Restore rehearsal has not been performed.** Completion/checksum verification does not establish a tested restore.

## Prepared script and safeguards

`server/prisma/operations/cleanup-development.ts` defaults to `plan` and reads using restricted `DATABASE_URL`. `backup` creates a dump without changing records. `apply` requires privileged `MIGRATION_DATABASE_URL`, the exact local development database, and a `CLEANUP_APPROVED_SHA256` matching the full reviewed manifest. Do not run `apply` before explicit human approval.

The script:

1. Compares the live snapshot with the reviewed manifest, including all employee/salary content and hashes of reference/authentication tables. Any change requires a fresh plan and approval.
2. Uses a SERIALIZABLE transaction and full row/gap locks to prevent concurrent changes. Stop the application and other writers for the maintenance window; do not run migrations concurrently.
3. Creates a **fresh full backup before deletion**, while transaction locks hold the data stable. Dump failure aborts cleanup. Docker container and local connection must still refer to the same development instance.
4. Deletes salary rows only for allowlisted employee IDs, then deletes employees by paired ID **and code**. Foreign keys remain enabled. No TRUNCATE, reseeding, grants, schema, or master-data changes.
5. Verifies exact deletion counts, exactly 10,000 employees remaining, unchanged seeded employee/full-salary hashes, and unchanged departments, designations, countries, currencies, exchange rates, users, and sessions before commit. Any failure rolls back all deletions.
6. A repeat execution against the unchanged already-cleaned dataset is a no-op. Unexpected changes stop execution; it never extends the allowlist automatically.

The private `.local-db-cleanup/manifest.json` contains the full allowlist and snapshot hashes. Backups and manifests are ignored by Git. No credentials are printed. The runtime role remains restricted; no application salary-delete privilege is added.

## Commands and actual validation

| Command | Result / exit code |
|---|---|
| `npm exec -w server -- tsx prisma/operations/cleanup-development.ts plan` | Final read-only run succeeded, **0**, counts above |
| `npm exec -w server -- tsx prisma/operations/cleanup-development.ts backup` | Dump/receipt created, **0** |
| `npm run typecheck -w server` | Passed, **0** |
| `npm run lint` | Passed, **0** |
| `git diff --check` | Passed, **0** |
| `git check-ignore .local-db-cleanup/manifest.json` | Confirmed ignored, **0** |

Independent Prisma raw SQL executed:

```sql
SELECT (SELECT COUNT(*) FROM employees) AS employees,
       (SELECT COUNT(*) FROM salary_records) AS salaries;
-- employees: 21114; salaries: 41816
```

The independent read command exited **0**. Docker container status was `Up 3 days` (exit 0). Initial sandbox attempts were blocked (exit 1); authorized read-only reruns succeeded. During tool preparation a raw-MySQL BigInt serialization issue and a nullable stderr typecheck issue were corrected; earlier diagnostic runs exited 1 and initial typecheck exited 2. They made no database changes.

No delete-path integration tests or restore tests were executed; **no deletion, rollback, or idempotency execution results are claimed**. These are code-reviewed safeguards pending approval and execution. Existing application suites were not rerun for this operator-only task. No commit or push was performed.
