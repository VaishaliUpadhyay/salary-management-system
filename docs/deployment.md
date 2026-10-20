# Deployment — Render Web Service + Aiven MySQL

This guide prepares one same-origin HTTPS assessment demo. **Nothing has been deployed by the agent.** Review the repository changes first. Creating the Render service starts deployment; do not do that until you approve the preparation results. Never reuse local/test URLs for this workflow.

## Architecture and prerequisites

Render terminates HTTPS and forwards HTTP to Express. Production Express serves `client/dist` and `/api/v1` on its supplied `PORT`, bound to `0.0.0.0`. Development retains Vite's proxy and loopback API binding. Existing hash URLs (`/#/employees/123`) survive refresh. Recognized clean paths redirect to the corresponding hash URL; this app does not use React Router. API paths, missing assets and unknown paths never fall back to HTML.

Use the repository's pinned Node 24.20.0 and npm 11.x (validated locally with 11.19.0). Keep the workspace root as Render's root directory. No new dependency or schema migration is introduced. See [Milestone 7 verification](milestone-7.md) for actual tests and limits.

## 1. Create a separate Aiven database

After reviewing this preparation, create an Aiven free **MySQL 8.x** service in a region near Render. Confirm the actual version (`SELECT VERSION()`), not just the product name. The migration requires MySQL >=8.0.16 for CHECK enforcement. Choose a separate database such as `salary_management_demo`; never use `salary_management_dev` or the isolated test name. Create it through authorized service controls or SQL if granted that capability.

Download the project's CA certificate from Aiven connection information. Retain the service DNS hostname and supplied port, not a guessed 3306/IP. URL-encode username/password reserved characters. Keep operator configuration in a separate ignored file, outside the repository where practical. Do not paste secrets into terminal command arguments, source, chat, screenshots or deployment logs.

Inspect the service's connection limits, storage, available backups and recovery controls. Restrict database ingress to Render's documented outbound ranges plus a temporary operator address where supported; remove operator access afterward. Region/range changes require review. Do not assume VPC access on the free plan.

## 2. Provision accounts without assuming root privileges

Separate the **operator/migration** identity from **runtime**. The checked-in migration creates InnoDB tables, indexes, foreign keys and CHECK constraints; it does not create users, roles or databases and requires no SUPER/DEFINER operations. Prisma `migrate deploy` uses the existing database and does not need a shadow database. The operator needs appropriate DDL and `_prisma_migrations` DML rights; seeding additionally needs application INSERT/SELECT and employee UPDATE. Confirm actual grants before execution.

Aiven's default new service users can have admin-level rights. Use its documented API to create a **new** runtime identity with this request body:

```json
{"username":"salary_runtime","mysql_grants":[]}
```

Use Aiven's authenticated tooling/secret handling; never commit an API token. Do not omit `mysql_grants`. If the service rejects granular grants, review pending service maintenance/capabilities; do not fall back to an administrative runtime identity.

With an authorized grant-capable operator, review and apply [aiven-runtime-grants.sql](../server/prisma/operations/aiven-runtime-grants.sql) **after migration**. Replace the database and account host with the actual values. Direct per-table grants avoid requiring CREATE ROLE/ROLE_ADMIN. This template intentionally gives master catalogs SELECT only because deployed APIs only read them. The local `runtime-role.sql` remains unchanged.

Before and after applying grants, inspect `SHOW GRANTS FOR CURRENT_USER()` while connected as runtime. Reject broad/global/schema grants, inherited administrative roles, grant options, or salary UPDATE/DELETE. MySQL privileges are additive: narrow grants do not cancel broad grants. If your operator cannot grant these table permissions, stop and resolve the provider permissions; do not weaken application startup checks.

Run as runtime, on the new demo database:

```sql
SELECT DATABASE(), CURRENT_USER(), VERSION();
SHOW GRANTS FOR CURRENT_USER();
EXPLAIN UPDATE salary_records SET amount=amount WHERE 1=0;
EXPLAIN DELETE FROM salary_records WHERE 1=0;
```

Both EXPLAIN statements must fail with MySQL **1142**. They do not change rows. The running app repeats these denials at startup and fails closed on success or an unexpected diagnostic. Aiven grant behavior has not been tested against your service in this task.

## 3. TLS for every cloud database connection

Use a verified CA connection with Prisma 6's native MySQL parameters:

```text
mysql://USER:URL_ENCODED_PASSWORD@SERVICE.aivencloud.com:PORT/salary_management_demo?sslcert=/ABSOLUTE/PATH/ca.pem&sslaccept=strict&connection_limit=5
```

For Render upload `aiven-ca.pem` as a **secret file**, available at `/etc/secrets/aiven-ca.pem`; set that absolute path in each URL. For operator commands use the absolute local CA path. This CA is not a private key, but it must come from the intended Aiven project. Do not use `sslaccept=accept_invalid_certs`, `NODE_TLS_REJECT_UNAUTHORIZED=0`, or another driver's `sslmode`/`sslrootcert` options as substitutes. The production startup validates an absolute readable PEM CA and strict mode; the connector performs the actual certificate handshake. Unit validation alone does not prove a valid certificate chain.

For native MySQL operator checks use `--ssl-mode=VERIFY_IDENTITY --ssl-ca=/absolute/path/ca.pem`, prompt for the password, and verify `SHOW SESSION STATUS LIKE 'Ssl_cipher'` is nonempty. Test a wrong CA on the remote connection to ensure verification fails before accepting the deployment. No cloud handshake was performed during repository preparation.

Start with `connection_limit=5` per application instance; leave capacity for migrations, maintenance and overlapping deploys. Measure and adjust against the service's actual limits; this is a conservative initial configuration, not a proven throughput setting.

### macOS P1011 despite a successful OpenSSL handshake

An observed Aiven server certificate passed OpenSSL chain/hostname validation but omitted the `serverAuth` Extended Key Usage extension. macOS SSL-policy validation rejected it with `Invalid Extended Key Usage for policy`; Prisma 6.19.3's native macOS connector consequently rejected it even with the correct absolute CA path. This is platform certificate-policy incompatibility, not evidence that `sslcert` is the wrong parameter.

Keep `sslcert` pointing to the Aiven project CA and `sslaccept=strict`. The same pinned CLI was verified on Linux: the correct CA reached pending-migration status, while an unrelated CA failed with P1011. Run operator commands there with the native OpenSSL backend (also the planned Render environment), retaining CA and hostname validation. For native macOS use, ask Aiven for a server certificate compatible with Apple's SSL policy, including serverAuth EKU. Do not disable verification, install broad Keychain trust exceptions, replace the CA with a client identity, or change ORM versions to hide this failure. See [the TLS investigation](aiven-tls-investigation.md) for executed checks and limitations.

Relative `sslcert=aiven-ca.pem` resolves against the Prisma schema directory in this single-file setup. Absolute paths remain recommended for operator/container/Render clarity, but changing to an absolute path did **not** resolve the macOS rejection. `migrate status` uses `MIGRATION_DATABASE_URL` through `directUrl`; modifying only `DATABASE_URL` does not fix CLI settings. Use a Linux-local CA path inside Linux, not a macOS host path.

## 4. One-time migration and explicit synthetic seed

Use a trusted operator machine with this reviewed source revision, Node/npm installed, and an **explicit separate** environment file (e.g. `/secure/path/salary-demo.env`, permissions 0600). Do not copy the local `server/.env`.

Operator file fields:

```dotenv
NODE_ENV=production
DATABASE_URL=mysql://RUNTIME_USER:REPLACE@SERVICE.aivencloud.com:PORT/salary_management_demo?sslcert=/absolute/path/ca.pem&sslaccept=strict&connection_limit=5
MIGRATION_DATABASE_URL=mysql://OPERATOR_USER:REPLACE@SERVICE.aivencloud.com:PORT/salary_management_demo?sslcert=/absolute/path/ca.pem&sslaccept=strict&connection_limit=2
SEED_DATABASE_NAME=salary_management_demo
SEED_HR_EMAIL=REPLACE_WITH_DEMO_HR_EMAIL
SEED_HR_PASSWORD=REPLACE_WITH_UNIQUE_12_TO_128_CHARACTER_PASSWORD
ALLOW_PRODUCTION_DEMO_SEED=I_ACKNOWLEDGE_EMPTY_SYNTHETIC_DEMO
```

Prisma CLI's default `.env` lookup is not the mechanism for this file. Load it explicitly with Node's `--env-file` into a child process, from the repository root:

```bash
npm ci --include=dev
node --env-file=/secure/path/salary-demo.env --input-type=module <<'JS'
import { spawnSync } from 'node:child_process';
const target = new URL(process.env.MIGRATION_DATABASE_URL);
if (!target.hostname.endsWith('.aivencloud.com') ||
    target.pathname !== '/salary_management_demo' ||
    target.searchParams.get('sslaccept') !== 'strict' ||
    !target.searchParams.get('sslcert')) throw new Error('Refusing unreviewed demo target');
for (const task of ['db:generate', 'db:validate', 'db:migrate', 'db:status']) {
  const result = spawnSync('npm', ['run', task], {
    stdio: 'inherit', env: { ...process.env, DOTENV_CONFIG_PATH: '/dev/null' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
JS
```

Review host/database and grants before running; `--env-file` does not override already exported variables, so use a fresh operator shell without old database variables. Generation and validation do not connect; migration/status do. No migrations run during Render build/start. Keep the operator identity off Render.

After migration, provision runtime table grants and verify them. Seed only the **new empty** schema using the dedicated guarded entry point:

```bash
DOTENV_CONFIG_PATH=/secure/path/salary-demo.env npm exec -w server -- tsx prisma/seed-demo.ts
```

The entry point refuses missing acknowledgement, non-production mode, non-Aiven hostnames, local/test schema names, mismatched target names, unsafe TLS and invalid HR credentials. It reuses the existing advisory-lock, empty-table refusal, row-count checks and single transaction; existing records are never overwritten. The normal local seed still refuses `NODE_ENV=production`. Never set the acknowledgement/password on the running Render service.

Expected initial counts: **10,000 employees / 30,700 salaries**. Verify them and master counts as an operator. If the connection fails around commit, inspect counts first; do not retry blindly, reset or truncate. If a rollback advanced auto-increment sequences, investigate before another seed; do not assume an empty schema has pristine sequences. Revoke/remove the bootstrap credentials and acknowledgement from the operator environment after use. Preserve the separately secured operator identity only for future authorized maintenance.

## 5. Render setup and commands

Only after explicit review approval, create a **Web Service**, native Node runtime, Free plan, linked to the reviewed branch/commit. Root directory: repository root (leave blank). Disable automatic deploys for controlled assessment releases. Do not add a database migration or seed to build/start. Free services do not provide the paid pre-deploy command workflow.

Build command:

```bash
npm ci --include=dev && npm run db:generate && npm run build
```

Start command:

```bash
npm run start -w server
```

The build includes TypeScript/Vite/Prisma tooling even when NODE_ENV is production; do not omit dev dependencies during build. The root build compiles both workspaces. Native dependencies and Prisma engines must be installed/generated on Render's Linux builder, never copied from macOS. Health path: `/api/v1/health`. Startup connects with the restricted runtime identity and verifies permissions before listening.

### Render environment

| Variable/file | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24.20.0`, matching `.nvmrc` |
| `APP_ORIGIN` | Exact `https://YOUR-SERVICE.onrender.com`, no trailing slash/path |
| `DATABASE_URL` | Restricted runtime URL with CA/strict TLS and bounded pool |
| `MIGRATION_DATABASE_URL` | **Same restricted runtime URL on Render**, only to satisfy Prisma's datasource tooling; never the privileged operator URL. No migrations are run here. |
| `TRUST_PROXY_HOPS` | `0` initially; set `1` only after the ingress verification below |
| `PORT` | Supplied by Render; normally 10000. Do not hardcode a local port. |
| Secret file `aiven-ca.pem` | Aiven project CA, referenced at `/etc/secrets/aiven-ca.pem` |

No VITE database/session variables, HR password, seed acknowledgement, Aiven API token or local/test database variables belong on Render. The placeholder names above are not real credentials. Do not enable shell tracing or log connection strings.

## 6. HTTPS, proxy and authentication verification

Render terminates TLS and redirects public HTTP to HTTPS. Express uses production Secure/HttpOnly/SameSite=Lax `__Host-salary_session` cookies with Path=/ and no Domain regardless of internal HTTP transport. Exact configured Origin and per-session CSRF checks remain mandatory; CORS stays disabled. No origin is derived from untrusted Host/forwarding headers.

Proxy trust defaults to **0** (ignore headers). This is safe against spoofing but may make the process-local login limiter share a proxy IP across visitors. For the intended single Render ingress path, verify that the immediate proxy supplies/appends the real client address as the rightmost X-Forwarded-For hop and untrusted clients cannot bypass the ingress. Only then set `TRUST_PROXY_HOPS=1`. Express will trust the immediate hop, not arbitrary left-hand addresses. Never set blanket trust or increase hops by trial and error. If Render's actual topology differs, retain 0 and review the configuration before public sign-in testing. Actual provider headers cannot be established by local unit tests.

Check through the public HTTPS URL:

- Root loads assets/charts with no CSP errors. Known clean paths redirect to hashes; refresh preserves the selected profile/filter route.
- `/api/v1/health` returns only health JSON. Missing `/api/*` returns JSON (401/404 as appropriate), never HTML. Missing assets return 404.
- Anonymous employee/analytics/import requests fail; no protected records render before login.
- Correct login works; incorrect credentials remain generic. Cookie has Secure/HttpOnly/SameSite=Lax/Path=/ and production name. Refresh restores session; logout revokes it; expired sessions return 401.
- Wrong/missing Origin and wrong/missing CSRF mutations fail. Changing a client-supplied left-hand forwarded address must not bypass the failed-login limit.
- Only synthetic demo data is present. Check seeded salary history and FX labels, and read-only analytics in multiple currencies.
- After separately authorizing remote smoke-test mutations, create/edit/deactivate a clearly labelled demo employee, append a valid salary and reject pre-hire/duplicate dates. Import a tiny synthetic CSV then replay and inspect skipped counts. These add remote records; do not represent the result as exactly 10,000 afterward.

Never publish HR credentials in a public README/video. Share assessment login details through the evaluator's intended private channel. Record the demonstration only after the deployment smoke checks pass.

## 7. Troubleshooting

- **Startup fails:** check Node version, built `client/dist/index.html`, exact origin, CA path, DNS/port, network access and restricted grants. Logs deliberately omit secrets. Use operator-side checks without printing URLs.
- **Port not detected:** production must bind `0.0.0.0` and Render's PORT. A database startup failure can prevent binding.
- **Login 403:** exact browser origin must equal APP_ORIGIN; no trailing slash or alternate hostname. Do not disable Origin/CSRF to fix it.
- **Login 429 for multiple visitors:** verify ingress/hop configuration; do not remove rate limiting. Limits reset on process restart and are not distributed.
- **TLS failure:** use the Aiven DNS name, correct project CA, absolute file path and Prisma 6 parameters. Never bypass certificate checks.
- **Prisma permission error:** migration and runtime identities have different purposes. Inspect actual grants; do not give runtime administrative privileges.
- **CSV network error/timeout:** a prefix may have committed. Reconcile and deliberately replay unchanged input; do not automatically retry or reset data.
- **Slow first load:** Render free instances sleep; wait for cold start. Distinguish cold-start latency from warmed API performance.

## 8. Rollback and recovery

Keep the reviewed commit and preceding working release identifiers. A code rollback does not undo database writes or migrations. This milestone introduces no schema changes; future schema changes need explicit backup/compatibility review. Check Aiven backup/restore capabilities and retention on your actual plan, and maintain an encrypted operator backup before destructive maintenance. Do not assume a restore button, free-tier forking or point-in-time recovery is available. Test recovery into a separate authorized target, not over the live demo. Never use reset, TRUNCATE or reseed as deployment recovery.

Render disks are ephemeral; database sessions/data live on Aiven and uploads are not persisted locally. Removing a service does not constitute data backup. Recover compromised secrets by controlled credential rotation; keep secrets out of Git and logs throughout.

## 9. Free-tier and verification limits

Render free services spin down after 15 idle minutes and may take about a minute to resume; no persistent disk or free pre-deploy hook is assumed. Aiven's documented free plan has one CPU, 1 GB RAM/disk, a 76-connection limit, no VPC/forking/SLA, and inactivity-related shutdown policies. Check current dashboard limits before deployment.

Milestone 6 unfiltered analytics missed the 500 ms p95 target locally on 21,114 employees; 10,000-row CSV creation took approximately 37 seconds. A network-separated free database can be slower. No production performance claim, managed TLS handshake, live grant verification, full cloud browser test or backup recovery test is made by this repository preparation. Record those results after manual deployment. The master-data administration scope and video deliverable remain separate from hosting preparation.

Official references checked for this plan: [Render web services](https://render.com/docs/web-services), [free limitations](https://render.com/docs/free), [deploy commands](https://render.com/docs/deploys), [secret files](https://render.com/docs/configure-environment-variables), [Aiven users/granular grants](https://aiven.io/docs/products/mysql/howto/manage-service-users), [Aiven TLS](https://aiven.io/docs/platform/concepts/tls-ssl-certificates), [Aiven free MySQL](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier), [Prisma 6 MySQL TLS parameters](https://docs.prisma.io/docs/orm/v6/overview/databases/mysql), [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/).
