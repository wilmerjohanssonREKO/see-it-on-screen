# REKO local pilot backend

This is a dedicated disposable local environment. It never connects to the live
REKO project, never reads its `.env`, and needs no cloud account or paid service.
The app's public/service keys and all account passwords are generated locally.

## Current verified mode

Real PostgreSQL 17, PostgREST 13, GoTrue 2.183 (Supabase Auth) and Mailpit 1.27.8.
The explicit `--without-storage` mode uses only a minimal Storage **schema test
double** required to replay historical app migrations. There is no working
Storage API in that mode; `/storage/v1/*` returns 503 and manifest
`storage_ready` is false. Do not describe it as a complete Supabase pilot.

Ten synthetic fixture accounts are provisioned through the real GoTrue admin
API (one admin, four schools, five approved substitutes). Fixture identities are
preconfirmed explicitly; separate signup/mail-verification/recovery tests are
needed to prove the email path. GoTrue's normal signup still requires email
confirmation and sends only to the internal Mailpit SMTP service.

## Run

From the repository root, with Node dependencies installed, Python 3 and a local
Docker daemon available:

```sh
REKO_PILOT_SOURCE="$PWD" python tests/pilot/fullstack/stack.py --without-storage
```

The app is `http://127.0.0.1:5182`, API `http://127.0.0.1:54451` and Mailpit HTTP
API `http://127.0.0.1:54451/local-mail/api/v1/messages` (or its normal v1 endpoints).
No Docker service ports are published. A local HTTP gateway bridges requests via
`docker exec` because this managed executor cannot directly reach Docker's NAT
ports. Gateway overhead is included in measured response times; this setup must
not be used to claim the capacity of Lovable's hosted service.

Runtime `manifest.json` contains the synthetic account credentials and source
version. It is mode 0600 in a mode 0700 directory and must never be committed or
included in public reports. Test runners should read it directly. Runtime files
and videos are ignored. Start waits for real service readiness and must be followed
by an app/login smoke check; a successful process launch is not sufficient.

Ctrl+C stops the app and removes only containers/network bearing this process's
unique `reko.pilot.run` ownership label, including its disposable PG volume. An
exclusive file lock prevents concurrent stacks. `REKO_PILOT_KEEP_FAILED=1` leaves
failed local containers for debugging; an explicit `--reset` on the next start verifies every dedicated pilot label
before resetting them. Existing pilot resources otherwise cause startup to refuse. Never run this against a production daemon.

All Docker calls explicitly target `unix:///var/run/docker.sock` and clear inherited
Docker endpoint selectors. The network is Docker `--internal`; service containers
also clear inherited HTTP/HTTPS/ALL proxy variables. SMTP points only to Mailpit.
The app has no Lovable provider credential and its sender verification flag is false.
Browser runners must also block outbound non-local navigation/requests.

## Full Storage mode and current limitation

Without `--without-storage`, the script attempts official
`supabase/storage-api:v1.26.0` and its own real schema migrations. That mode has
not been verified successfully in this executor. Its VFS Docker filesystem and
524,288-inode limit prevented extracting/starting the official image even after
reclaiming known disposable old test volumes. Disk bytes alone did not describe
the limit. The current partial mode is deliberate, not an automatic hidden fallback.

A local packaging experiment also exceeded this executor's inode budget and is
not part of the supported pilot runner. It does not establish Storage readiness.

A larger executor with adequate disk/inodes, or a reviewed immutable runtime/code
volume layout, is required before private CV upload/download, signed URL expiry
and consent revocation can become full pilot acceptance criteria. Until then,
Storage scenarios must be explicitly marked blocked, not counted as passing.

## Next test stages

Run the browser model with five distinct accounts first, then reset only synthetic
pilot jobs and run ten accounts. Treat these as functional rehearsals on the local
executor. Keep larger load stages blocked until full Storage and an appropriate
capacity environment exist. Never extrapolate hosted concurrent-user limits from
this single local machine and Docker-exec gateway.
