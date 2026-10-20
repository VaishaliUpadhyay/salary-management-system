# Milestone 7 — production deployment preparation

Date: 2026-10-20 (user timezone). **Repository preparation checks PASS; cloud deployment has not started.** User approved the proposal and explicitly prohibited connecting to local/test databases, deployment, commit or push. These restrictions were observed.

## Implemented

- Production Express serves built Vite assets from a module-relative path, verifies the build exists, binds 0.0.0.0 using PORT, and retains the existing loopback/Vite development workflow.
- Existing hash navigation is preserved. Recognized clean routes redirect to hashes with their query string. API routing/auth/errors precede static handling; missing API/asset paths never return index HTML.
- API CSP stays restrictive. UI CSP allows same-origin bundles/requests and required React/Recharts inline styling, not inline/eval scripts. Index is no-store; fingerprinted assets receive immutable caching. Dotfiles are not served.
- Production configuration requires exact HTTPS APP_ORIGIN, strict Prisma MySQL TLS and a readable absolute CA PEM path. Error diagnostics omit secret values. Existing production cookie, CSRF, Origin, authorization and runtime salary permission checks remain active.
- Proxy trust defaults to 0; explicit 1-hop opt-in is documented with provider verification requirements. Tests prove changing a left-hand spoofed forwarding address does not bypass the login limiter when the trusted ingress supplies the rightmost client address. This does not prove Render's live ingress topology.
- Aiven provisioning template uses a fresh zero-grant service user, direct table permissions and read-only master catalogs; no CREATE ROLE/root assumption. The local role template/schema/migration remain unchanged.
- Separate `seed-demo.ts` requires production mode, explicit empty-synthetic-demo acknowledgement, a separate matching Aiven target and strict TLS. It reuses the existing empty-table checks/advisory lock/transaction/count verification. Normal local seed behavior is unchanged; no bootstrap is part of build/start.
- Deployment guide covers operator migration/seed, CA handling, Render settings, permission checks, smoke tests, free-tier limits and recovery. Owner/seed credentials are kept off Render. No dependency added.

## Actual commands and results

Tests ran with `DOTENV_CONFIG_PATH=/dev/null`, `DATABASE_URL` and `MIGRATION_DATABASE_URL` set to dummy `192.0.2.1:9/not_connected` URLs, and no real database credentials supplied. Ordinary checks used NODE_ENV=test; the clean production build and fail-closed start check used NODE_ENV=production. The browser production host instantiates **no Prisma client** and browser API interactions are mocked.

| Command | Actual result | Exit |
|---|---|---:|
| `npm test` | Frontend: 4 files, **93 passed**; backend: 10 files, **116 passed** | 0 |
| `npm run lint` | Passed, zero warnings | 0 |
| `npm run typecheck` | Both workspaces passed | 0 |
| `npm run build` | Vite frontend and Express TypeScript production builds passed | 0 |
| `npm run db:validate` | Schema valid; no database connection | 0 |
| `npm run test:browser` | **15 passed**, existing Vite workflow | 0 |
| `QA_PRODUCTION_UI=1 npm run test:browser` | **16 passed**, built frontend served by Express with production CSP | 0 |
| `npm ci --include=dev` | Passed in clean temporary source copy, no real environment files | 0 |
| `npm run db:generate` | Passed in that clean copy; no database connection | 0 |
| `npm run build` (clean copy, production mode) | Both workspace builds passed | 0 |
| `npm run start -w server` (intentionally unsafe dummy production URL) | Correctly refused configuration before connecting; generic safe diagnostic | **1 expected** |
| `git diff --check` | No whitespace errors | 0 |

Final suites have zero failed/skipped tests. There are **240 passing test executions**: 93 + 116 + 15 + 16. Fifteen browser scenarios repeat across development/production hosts, so this is **225 distinct tests**, not 240 unique cases. The backend count here is the non-database suite; it must not be confused with the previous milestone's 116 MySQL integration tests, which were not run.

Initial checks exposed and resolved: an exact-optional-property TypeScript error (typecheck/build exit 2); sandbox refusal to bind local HTTP ports (test exit 1, rerun with local-port permission); and the production browser harness's incorrect npm workspace command (exit 1, fixed to the installed local tsx binary). The final results above follow those corrections. Browser output has harmless color-environment warnings.

Logs are local `/tmp/m7-verified-{test,lint,typecheck,build}.log`, `/tmp/m7-final-{validate,browser}.log`, `/tmp/m7-production-browser-retry.log`, `/tmp/m7-clean-{install,generate,build}.log` and `/tmp/m7-start-refusal.log`. No credentials were recorded. A successful real server startup cannot be claimed without the intentionally deferred database connection; the compiled start command was exercised only for fail-closed configuration behavior.

## Exact deployment commands

From the repository root, Render native Node runtime:

```bash
npm ci --include=dev && npm run db:generate && npm run build
```

Start:

```bash
npm run start -w server
```

The build sequence was verified with Node 24.20.0/npm 11.19.0 in a fresh copy and production NODE_ENV. Render must install/generate its own Linux artifacts. Required settings: NODE_ENV=production, NODE_VERSION=24.20.0, exact HTTPS APP_ORIGIN, strict-TLS restricted DATABASE_URL, MIGRATION_DATABASE_URL set to the same **restricted** URL for tooling only, and an Aiven CA secret file. PORT is platform-supplied. TRUST_PROXY_HOPS defaults to 0; enable 1 only following the guide's verified ingress conditions. No privileged migration URL or HR/seed password belongs on Render.

## Files changed

- `server/src/app.ts`, `server/src/index.ts`, `server/src/lib/env.ts`: production integration, binding/configuration and safe startup handling.
- `server/src/lib/frontend.ts`, `server/src/lib/production.ts`: frontend boundary/CSP and TLS/demo-target guards.
- `server/prisma/seed-demo.ts`, `server/prisma/operations/aiven-runtime-grants.sql`: guarded operator bootstrap and managed grants template.
- `server/.env.example`: documented proxy opt-in, local default retained.
- `server/test/production.test.ts`, `server/test/frontend-preview.ts`: non-database regressions and database-free browser host.
- `client/playwright.config.ts`, `client/e2e/production.spec.ts`: production-artifact browser mode and CSP/deep-link regression.
- `docs/deployment.md`, `docs/milestone-7.md`, README, setup/architecture/decisions/AI usage and `prompts/013-milestone-7.md`: deployment instructions and evidence.

## Not run / remaining limitations

- **No database integration tests, runtime DB checks, migrations, seeds, CSV or analytics benchmarks**: these would connect to prohibited local/test schemas or require an authorized remote target.
- No Aiven account/service created; actual version/grants, migration compatibility, TLS handshake/certificate-negative test, initial counts and backup recovery remain manual acceptance gates. The guide does not assume root/CREATE ROLE/SUPER or blanket grant availability.
- No Render service created, Linux-hosted build, real HTTPS cookie check, live proxy-chain verification, cloud E2E or cloud latency/import-timeout measurement. Mocked browser success is not evidence of deployed authentication/database functionality.
- Existing process-local rate-limit/cold-start/performance limitations remain. No new roles, master-data administration, schema changes or performance claims are introduced. Production UI styles permit inline styling for existing components; scripts remain same-origin only.
- User previously reported Milestones 1–6/manual workflows complete. This task adds AI-executed preparation checks, not new human deployment verification. Video and public URL are still pending.

## Next manual step

**First review and approve these repository results.** After that review, the first cloud step is to create a separate Aiven free MySQL 8.x service/database (for example `salary_management_demo`), download its project CA and inspect the available user/grant controls. Follow [deployment.md](deployment.md) in order. Do not create the Render Web Service until the new database is migrated/seeded and restricted TLS access verified: Render creation initiates deployment.

Nothing is staged/committed/pushed/deployed automatically. No existing database records were read or changed. Suggested commit after review: `feat: prepare secure same-origin Render and Aiven deployment`.
