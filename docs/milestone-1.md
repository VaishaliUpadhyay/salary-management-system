# Milestone 1 — scaffold, schema and seed

2026-10-15. User approved the technical design and authorized this implementation milestone. Code, offline checks and live MySQL migration/seed/integration checks are complete. Restricted runtime grants remain pending. No business APIs, authentication implementation, frontend features, deployment, commits or pushes were added.

## Files and responsibilities

- Root package.json/package-lock.json: npm workspaces and pinned dependencies; shared TypeScript, ESLint, Node and npm settings.
- client/: React/TypeScript/Vite title-only shell, Tailwind integration, shadcn configuration/utility and Recharts dependency. No employee screens or charts yet.
- server/src/: Express app/listener, safe environment validation and Prisma client wiring; unmatched paths return 404 and expose no data.
- server/prisma/schema.prisma: all nine approved models, mapped names/native types, eight RESTRICT foreign keys, unique constraints and indexes.
- server/prisma/migrations/: generated initial MySQL migration, manually reviewed and augmented for InnoDB, ASCII binary codes/tokens, and three CHECK constraints.
- server/prisma/seed-data.ts, seed-runner.ts, seed.ts: deterministic pure fixtures, transaction-owned population, empty-database refusal/advisory lock, explicit target acknowledgement and environment-supplied argon2id password.
- server/prisma/operations/runtime-role.sql: unexecuted operator template for restricted runtime grants, separate from migration/seed owner credentials.
- server/test/: seven fast/API scaffold tests and seven separately gated MySQL integration checks. Vitest configs keep database tests out of the default suite.
- README/environment examples: reproducible installation, configuration, migration, seed, testing/development and deferred deployment instructions.

## Migration review

Generated using Prisma 6.19.3 `migrate diff --from-empty --to-schema-datamodel server/prisma/schema.prisma --script`, which does not connect to a database. Manual review confirmed:

- employees stores country/designation FKs, not department/current salary; employee code is unique, email is not.
- designation name is unique within department; department FK is indexed through that unique key.
- salary_records uses DECIMAL(15,2), DATE, creator FK and unique employee/effective-date index; no update timestamp or cascade deletion.
- rates use DECIMAL(24,12), source, DATE and unique currency/date.
- all foreign keys match unsigned IDs or matching ASCII currency codes and restrict updates/deletes.
- added salary nonnegative, positive rate and USD identity CHECK constraints outside Prisma's schema representation.
- explicit InnoDB and collations preserve the approved behavior without relying on server defaults.
- SQL contains no DROP/TRUNCATE/DELETE; ALTER statements attach constraints to newly created tables. MySQL DDL partial-failure recovery must be reviewed before any retry.

Cross-table hire-date/status rules remain service responsibilities for the next milestone. The seed conforms to those rules; the migration does not claim to enforce them through cross-table CHECK constraints. Runtime append-only privileges are documented but not applied or verified.

## Commands and evidence

| Commands/checks | Result |
|---|---|
| node --version / npm --version | Node 24.20.0, npm 11.19.0 |
| npm install (workspace dependencies), reviewed npm install-scripts approve/rebuild | Completed; exact versions locked. Registry/cache access required sandbox escalation |
| npm update deepmerge-ts; npm audit --json | Patched transitive tooling dependency installed; 0 vulnerabilities reported |
| npm run db:validate with nonsecret placeholder URL variables | PASS. Initial attempt without environment variables correctly failed for missing MIGRATION_DATABASE_URL |
| npm run db:generate | PASS after granting access to Prisma's engine cache |
| npx prisma format; prisma migrate diff --from-empty ... --script | PASS; SQL generated without connecting to MySQL |
| npm run typecheck | PASS for client and server, including seed/test TypeScript |
| npm run lint | PASS, zero warnings |
| npm test | PASS: 3 files, 7 tests. Initial environment-error duplication fixed; Supertest required loopback access outside sandbox |
| npm run build | PASS: Vite production assets and backend TypeScript output |
| Native argon2id hash/verify smoke check | PASS; ephemeral password/hash were not printed |
| npm run test:db | **Blocked**: suite setup rejected missing TEST_DATABASE_URL/TEST_DATABASE_NAME; 7 assertions skipped, no live constraint verification |
| docker info | Docker CLI present but daemon not running after socket-access permission; mysql CLI not found |
| git diff --check / local documentation link checks | PASS |

## Deterministic fixture evidence

Tests generate 10,000 employees and 30,700 salary rows twice and compare digests, check unique codes/dates, all employee/master/currency references, effectiveDate >= hireDate, nonnegative two-decimal amounts, future-only employees, zero salary, inactive cohort and independent country/currency cases. Counts: 8 departments, 24 designations, 6 countries/currencies, 12 rate snapshots, 400 inactive employees, 100 future hires. These are generator validations, not evidence of a successful database seed.

## Initial environment limitation (resolved by follow-up)

No database URL was supplied. Therefore migration deployment/status, full seed commit/rollback/rerun behavior, MySQL CHECK/FK enforcement, conversion-expression execution, runtime grant denial and database performance have **not** been verified. Configure an explicitly approved empty development database and separate migrated empty test database to run the documented commands. No existing database was reset, overwritten or seeded. No production readiness or sub-500 ms performance claim is made.

The deepmerge-ts 8.0.0 override addresses [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) in Prisma tooling; schema generation/validation passed with the override. Prisma 6.19.3 was selected to implement the approved Prisma schema/migration workflow without introducing a new adapter/configuration architecture. Remove the override only after a compatible upstream fix and rerun checks. Reference: [Prisma 6 system requirements](https://www.prisma.io/docs/orm/v6/reference/system-requirements), [Vite setup](https://vite.dev/guide/).

Suggested commit (not created): `chore: scaffold workspaces and add Prisma schema with deterministic seed`.


## Live database follow-up — 2026-10-15

The user supplied local Docker MySQL and explicitly authorized migration, validation and persistent seeding. MySQL **8.0.46**, strict SQL mode, system timezone UTC. The authorized development schema `salary_management_dev` was verified to contain no tables before migration. No reset/drop/truncate or modification of pre-existing data was performed.

- Found stale MIGRATION_DATABASE_URL targeting `salary_management`. Used DATABASE_URL's verified `salary_management_dev` connection as a process-only migration/seed override; did not alter local `.env` or expose credentials.
- `npm run db:migrate`: PASS in development and new isolated test schema `salary_management_m1_test_20261015`.
- `npm run test:db`: initially 6 passed / 1 failed because SHOW WARNINGS is unsupported in MySQL's prepared protocol (error 1295). Corrected the test to compare actual basic/extreme decimal results directly. Rerun: **7 passed**, approximately 2.20 seconds for the suite. This is test duration, not an API latency measurement.
- Native MySQL text-protocol check: 100 USD × 0.91 EUR/USD = 91.000000000000000000000000; zero warnings. MySQL also disallows prepared references to @@warning_count, so no invalid replacement is used. [MySQL prepared-statement restrictions](https://dev.mysql.com/doc/refman/8.0/en/sql-prepared-statements.html).
- `npm run db:seed`: PASS, transaction committed. Actual persisted counts: employees **10,000**, salary_records **30,700**, departments **8**, designations **24**, countries **6**, currencies **6**, exchange_rates **12**, users **1**, sessions **0**; inactive employees **400**.
- Live data checks: **0** pre-hire salaries, **0** duplicate employee/effective-date pairs, **0** negative amounts. At fixed reference date 2026-10-15: **1,000** future revisions, **9,900** employees with current compensation including inactive employees.
- Stored HR credential verified successfully as argon2id against the local configured seed password; neither password nor hash was logged.
- Repeated seedDatabase call refused the populated schema; employee/salary counts remained 10,000/30,700.
- `npm run db:status`: schema up to date. Metadata confirms **8 foreign keys**, **3 CHECK constraints**, **11 unique constraints** (plus primary keys; Prisma's migration table adds its own primary key).
- Isolated test schema: **0 employees / 0 salaries** after rollback; other fixtures checked empty by the suite. Schema remains intact for reuse, not deleted.
- `npm run typecheck` and `npm run lint`: PASS after the test fix.

Runtime-role.sql now consistently targets `salary_management_dev`. The configured database connection is administrative (global UPDATE/DELETE and other grants); an earlier coarse check for literal “ALL PRIVILEGES” was insufficient because MySQL enumerates privileges. Full grants inspection established the actual permissions. The role template has not been applied, and salary-history immutability through a restricted application account remains unverified. The uniqueness/FK/CHECK constraints are enforced, but privileged operator SQL can still mutate rows. Provision a separate restricted runtime account before business endpoint implementation. No new roles/accounts or global grants were created during this follow-up.

Full reporting arithmetic/aggregate boundaries and a Prisma-compatible warning-handling strategy remain analytics-milestone work. No business APIs/features, deployment, commits or pushes were added.
