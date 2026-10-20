# Fresh local setup

Use Node 24.15+ (within 24.x), npm 11.x and MySQL 8.x (validated with 8.0.46). Run repository commands from its root unless noted. These instructions are for **new, empty schemas**; they do not reset or upgrade an existing populated database automatically.

## Install and configure

```bash
# If using nvm, install/select the validated version pinned in .nvmrc:
nvm install
nvm use
npm ci
cp -n server/.env.example server/.env
```

Edit the ignored `server/.env` locally. Never put secrets in client variables or paste connection URLs into reports. URL-encode password characters in URLs. `APP_ORIGIN=http://localhost:5173` must match the browser URL exactly, including hostname. The frontend needs no environment variables for local use; Vite proxies `/api` to port 3000.

## Create isolated schemas and owner accounts

Connect to your local MySQL instance using an administrator's interactive client (`mysql -h 127.0.0.1 -u root -p`, or your container's equivalent). Use separate fresh passwords in the placeholders below; do not save completed SQL in Git. Account host restrictions must match your local connection/container network; `%` below is for an isolated local MySQL instance, not a production grant recommendation.

```sql
CREATE DATABASE salary_management_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE salary_management_m1_test_20261015 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'salary_owner'@'%' IDENTIFIED BY 'REPLACE_LOCALLY';
CREATE USER 'salary_test_owner'@'%' IDENTIFIED BY 'REPLACE_LOCALLY';
GRANT ALL PRIVILEGES ON salary_management_dev.* TO 'salary_owner'@'%';
GRANT ALL PRIVILEGES ON salary_management_m1_test_20261015.* TO 'salary_test_owner'@'%';
```

These deliberately omit `IF NOT EXISTS`: inspect any existing schemas/accounts instead of silently reusing them. Configure `MIGRATION_DATABASE_URL` for `salary_owner`, and `TEST_DATABASE_URL` for `salary_test_owner`. Set `TEST_DATABASE_NAME=salary_management_m1_test_20261015`; the integration harness intentionally accepts only this isolated name. Set `DATABASE_URL` and `TEST_RUNTIME_DATABASE_URL` to the restricted accounts provisioned below (they need not exist for migration deployment).

## Generate and migrate

```bash
npm run db:generate
npm run db:validate
npm run db:migrate
npm run db:status
```

Prisma uses `MIGRATION_DATABASE_URL` via `directUrl`. To migrate the **test schema only**, run this from `server/`; it reads the ignored environment file and passes credentials directly to the child process without printing them:

```bash
cd server
node --input-type=module <<'JS'
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== '/salary_management_m1_test_20261015') {
  throw new Error('Configure the isolated test database first');
}
const result = spawnSync('npm', ['run', 'db:migrate'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url },
});
process.exitCode = result.status ?? 1;
JS
cd ..
```

No shadow schema, `migrate reset`, `db push`, DROP or TRUNCATE is needed. The checked-in migration includes constraints/collations beyond Prisma's declarative schema; deploy it rather than reconstructing tables with `db push`.

## Provision restricted runtime accounts

After both migrations, review and execute `server/prisma/operations/runtime-role.sql` in the administrator's MySQL client. It grants the `salary_runtime` role only development-table privileges. Then create a fresh runtime login:

```sql
CREATE USER 'salary_app'@'%' IDENTIFIED BY 'REPLACE_LOCALLY';
GRANT 'salary_runtime' TO 'salary_app'@'%';
SET DEFAULT ROLE 'salary_runtime' TO 'salary_app'@'%';
```

For tests, make a local copy of that SQL template, replacing **both** `salary_management_dev` with `salary_management_m1_test_20261015` and `salary_runtime` with `salary_test_runtime`. Review and execute it as administrator, then:

```sql
CREATE USER 'salary_test_app'@'%' IDENTIFIED BY 'REPLACE_LOCALLY';
GRANT 'salary_test_runtime' TO 'salary_test_app'@'%';
SET DEFAULT ROLE 'salary_test_runtime' TO 'salary_test_app'@'%';
```

Set `DATABASE_URL` to `salary_app` on development and `TEST_RUNTIME_DATABASE_URL` to `salary_test_app` on test. Give neither account additional global/schema grants: MySQL privileges are additive. Runtime salary UPDATE/DELETE must fail; migrations and fixture cleanup use the separate owner accounts. The Docker provisioning helper is an operator-specific alternative, not a prerequisite for this portable setup.

## Seed once, start, verify

Set `SEED_DATABASE_NAME=salary_management_dev`, a local `SEED_HR_EMAIL`, and a 12–128-character `SEED_HR_PASSWORD`. Then:

```bash
npm run db:seed
npm exec -w server -- tsx prisma/operations/verify-runtime.ts
npm run dev
```

The insert-only deterministic seed creates 10,000 employees and 30,700 salary revisions; it refuses nonempty application tables. Never seed the integration schema: tests own their fixtures. Open http://localhost:5173 and sign in with the configured HR credentials. The API listens on http://127.0.0.1:3000. Keep production credentials out of local examples.

```bash
npm test
npm run test:db
npm exec -w client -- playwright install chromium
npm run test:browser
npm run lint
npm run typecheck
npm run build
```

Do not run database tests and CSV benchmarks concurrently. They refuse nonempty test application tables, create only isolated fixtures, then clean those fixtures. Inspect interrupted test runs rather than resetting the schema. Chromium tests use mocked APIs, not development mutations.

`npm run build` creates ignored `client/dist` and `server/dist`; `npm run start -w server` starts the compiled API. With `NODE_ENV=production`, it now hosts the built frontend as described in [deployment](deployment.md); strict TLS configuration and restricted runtime credentials are required. `npm run preview -w client` previews assets but is not a production deployment or the documented API proxy workflow. Production serving/CSP configuration is prepared; live HTTPS/proxy/provider verification remains pending. Do not describe these local instructions as deployed production readiness.

For CSV examples, results, idempotency and timeout behavior see [Milestone 5](milestone-5.md). For the actual clean-install verification boundary and latest results see [Milestone 6](milestone-6.md).
