# Aiven TLS investigation — Prisma 6.19.3

## Confirmed cause before repository edits

The supplied Aiven server certificate has **no Extended Key Usage extension**. Its CA chain/signature and exact DNS hostname validate with OpenSSL. macOS accepts the same chain under basic certificate policy but rejects it under SSL policy with **Invalid Extended Key Usage for policy**. Prisma's native macOS MySQL connector reports **The certificate was not trusted**, including with an absolute CA path. This is platform-policy incompatibility, not a wrong URL parameter or missing CA file.

Evidence was explained to the user before documentation edits. No application/schema/credential/Keychain change was made. The user's pre-existing `.gitignore` edits were preserved.

## Exact connector semantics

Installed `prisma`, `@prisma/client` and `@prisma/engines` are 6.19.3; engine revision is `c2990dca591cba766e3b7ef5d9e8a84796e47ab7`.

- The [matching MySQL URL parser](https://raw.githubusercontent.com/prisma/prisma-engines/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/quaint/src/connector/mysql/url.rs) passes `sslcert` to the driver's root-certificate-path option. The Aiven CA belongs here.
- `sslaccept=strict` disables acceptance of invalid certificates; the engine's test also asserts domain validation remains enabled. Set it explicitly; do not rely on the permissive default.
- `sslidentity` is a client identity (PKCS#12), with `sslpassword` for its password. Neither substitutes for a root CA. Another driver's `sslrootcert`/`sslmode` parameters are not a secure fix.
- [Prisma certificate-path documentation](https://docs.prisma.io/docs/orm/v6/prisma-schema/overview/data-sources) specifies schema-relative paths. This repo uses `server/prisma/schema.prisma`, so `aiven-ca.pem` identifies the CA alongside it. Both cloud URLs use that path and strict mode.
- `directUrl` points at `MIGRATION_DATABASE_URL`; `migrate status` does not simply use the application URL. Both URLs were adjusted **in memory only** for absolute-path comparisons.
- The [engine lockfile](https://raw.githubusercontent.com/prisma/prisma-engines/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/Cargo.lock) pins native-tls 0.2.14 for the MySQL driver. [That implementation](https://raw.githubusercontent.com/sfackler/rust-native-tls/v0.2.14/src/lib.rs) uses Apple's TLS framework on macOS and OpenSSL on Linux. Successful OpenSSL validation does not establish acceptance by macOS SSL policy.

## Read-only diagnostic evidence

Cloud configuration was parsed in memory with Aiven-host guards and no local/test targets. No complete connection URL or password was printed.

| Check | Observed result |
|---|---|
| OpenSSL MySQL handshake, explicit CA/SNI/hostname and verify-return-error | Exit 0; Verification OK; return code 0 |
| Presented CA vs configured CA | Exact certificate fingerprint match |
| Leaf signature under configured CA | Valid |
| Leaf SAN vs configured DNS hostname | Match |
| Certificate dates/key | Currently valid; RSA 3072 bits; leaf lifetime about 820.125 days |
| Leaf EKU | Absent |
| macOS security verify-cert, explicit CA, basic policy | Exit 0; verification successful |
| Same chain with macOS SSL policy and hostname | Exit 1; **Invalid Extended Key Usage for policy** |
| Prisma Client SELECT 1, absolute CA and strict mode | Connection rejected: **The certificate was not trusted**; query did not execute |
| Prisma migrate status, relative/absolute CA, root/server working directories | Exit 1; this execution emitted a blank schema-engine error rather than the user's reported P1011 text |

Initial sandboxed macOS checks produced misleading `No error` output with exit 1 because system trust services were inaccessible; the table records repeated checks with permitted access. No trust settings changed. Generic CT diagnostic lines were also emitted, but the explicit SSL-policy result identifies EKU as the failure; no CT bypass was attempted.

[Apple's certificate requirements](https://support.apple.com/en-us/103769) require serverAuth EKU for TLS server certificates issued after July 2019. The observed certificate lacks it. A CA file supplies trust anchors; it cannot add EKU to a signed server certificate.

## Smallest secure resolution

Keep Prisma 6.19.3, the MySQL schema and strict CA/hostname verification unchanged. Run operator Prisma commands on Linux, matching Render, with a CA path valid there. Use **migrate status only** for diagnosis; do not execute migrate deploy, seed, reset or writes. Nonzero status can mean pending migrations rather than TLS failure.

If native macOS operation is required, request an Aiven-issued server certificate satisfying macOS SSL policy. Do not locally rewrite a certificate or add trust exceptions. No provider certificate change was attempted. The validated Linux workaround below does not repair the certificate or establish all production checks.


## Linux positive and negative controls — actual results

A disposable `node:24.20.0-bookworm` container installed only `prisma@6.19.3` in temporary storage. The existing Prisma directory was mounted **read-only**. Aiven environment values were passed through stdin, not command-line URLs or Docker environment metadata. Original environment files were not mounted or changed. The container was removed after execution; the downloaded image remains cached. Existing database containers were not accessed.

Both trials ran `prisma migrate status --schema /schema/schema.prisma`, with URLs changed in memory only:

| Trial | TLS settings | Result | Command exit |
|---|---|---|---:|
| Correct project CA | `sslcert=/schema/aiven-ca.pem&sslaccept=strict` | Successful connection; unapplied migrations, no TLS error | 1 (pending migrations) |
| Unrelated valid public CA | `sslcert=/etc/ssl/certs/ISRG_Root_X1.pem&sslaccept=strict` | P1011; certificate validation rejects the connection | 1 (TLS rejection) |

Pinned Prisma installation exited 0; the two-trial diagnostic harness exited 0. No migration was applied. The positive trial establishes Linux connectivity with strict verification. The negative control proves it did not silently accept an untrusted CA. Hostname verification remains enabled by the pinned connector; OpenSSL also explicitly verified the exact hostname.

### Next operator command (read-only)

In Linux with the reviewed repository, installed pinned dependencies and a secure environment file whose CA paths exist **inside Linux**:

```bash
node --env-file=/secure/path/salary-demo.env node_modules/prisma/build/index.js migrate status --schema server/prisma/schema.prisma
```

Keep both URLs on the intended Aiven schema with strict TLS; `MIGRATION_DATABASE_URL` controls this command. Use a clean shell so exported variables do not override the file. Do not substitute `migrate deploy` because status reports pending migrations. Migration/seed authorization is separate and was not part of this investigation.

## Scope

Only documentation changed. No credentials, datasource, application TLS code, dependency versions, CA or Keychain settings changed. Only read-only cloud status/connection and certificate checks ran. No migration, seed/reset, data write, deployment, commit or push occurred. Local and test databases were not contacted. User-owned `.gitignore` edits were preserved, including its existing trailing-blank-line warning.
