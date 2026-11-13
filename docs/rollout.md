# REKO: rollout and operational checks

Release status: PR #1 was merged and version `96d0005` was verified ready in the
Lovable preview on 2026-11-12. Migrations 0019–0022 were applied and recorded in
the migration ledger; existing accounts and assignments were preserved. No external
test emails were sent and the site was not published by this work.

PR #2 proposes migration 0023 and additional flow fixes. Those changes have not
been applied to the live project. For an upgrade from `96d0005`, apply only the
new pending migration through the normal migration runner; do not replay applied
migrations. Review `flow-test-report-2026-11-13.md` before deploying that upgrade.
The steps below also describe prerequisites for a fresh rollout.

## Apply safely to the connected project

1. Confirm a current Supabase backup and perform a restore rehearsal in a separate
   database. Record recovery point/time and the responsible REKO operator.
2. Take the Lovable-connected main head as the release base. Do not force-push,
   squash, amend or rebase commits already pushed to the connected history.
3. Apply additive migrations 0019, 0020, 0021 and 0022 in that order with the normal
   deployment migration runner. The journal is updated; historical migrations are
   unchanged. Do not run schema generation from the intentionally empty
   drizzle/schema.ts. No historical bookings are backfilled or reopened.
4. Deploy the matching application code immediately after migration. Existing
   filled assignments stay filled. Legacy claim_assignment only applies; older
   clients must reload to understand the new result. Use a brief maintenance
   window to avoid old-client messages during the switch.
5. Create fresh sandbox school/substitute fixtures via administrator controls.
   Never toggle a school with assignment history into test mode or use real jobs.
   Original supplied test-named accounts are not sandbox-isolated and remain unchanged.
6. Verify signup, invitation acceptance and recovery on the actual preview origin.
   Then school publishes -> substitute applies -> school chooses -> both see the
   booking -> cancellation request -> admin approval/denial. Check private files,
   overlapping concurrent choices and account changes using separate fixture identities.
7. Enable the delivery worker only after sender verification and sandbox checks.
   Keep a REKO admin responsible for queue failures and incomplete account deletion jobs.

## Authentication configuration

Set REKO_PUBLIC_URL to the exact production HTTPS origin, without path/query/hash.
Allow only the required production and controlled preview URLs in Supabase Auth:
/auth, /inbjudan and /aterstall-losenord. Enable email confirmation. Verify the
recovery and email-verification redirects through actual mailbox delivery before launch.
Existing accounts and passwords are retained. New school/teacher membership requires
an admin invitation, control of the exact verified email and a password set by the user.
Invitations expire in 48 hours, are one-use, revoke previous pending invitations for
the same school/email, and never return the bearer token in admin listings.

## Transactional email and worker

Required hosting secrets/settings (never commit actual values):
- existing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY;
- LOVABLE_API_KEY and the managed LOVABLE_SEND_URL if required by the provider;
- REKO_EMAIL_SENDER_DOMAIN, matching the verified delegated sender subdomain;
- REKO_EMAIL_FROM and REKO_EMAIL_REPLY_TO (intended address: hej@rekoweb.com);
- REKO_EMAIL_SENDER_VERIFIED=true only after provider verification;
- LOVABLE_CRON_SECRET, with optional LOVABLE_CRON_SECRET_PREVIOUS during rotation.

Schedule an HTTPS POST to /api/cron/outbox approximately once a minute using the
Authorization: Bearer header with the cron secret. The endpoint refuses missing or
incorrect credentials. Do not put the secret in a URL, browser bundle or repository.
There is also a clearly confirmed admin action for manually processing a small batch.
An endpoint does not configure its schedule: the hosting scheduler still must be set up.

Jobs are committed with each booking transition, versioned per allocation/recipient,
leased to a worker and retried up to 8 times with backoff. Expired final leases become
failed. Monitor oldest pending job age, failed/retry/suppressed counts and worker
health. Sandbox markers are rechecked before delivery, missing relationships fail
closed, and test notices are captured internally instead of sent.

The public DNS check on 2026-11-12 found a Zoho SPF record on rekoweb.com, no answer
for NS at notify.rekoweb.com and no DMARC TXT record at _dmarc.rekoweb.com. This is
not provider verification. Obtain the exact required DNS records from the selected
transactional email provider. Do not replace existing Zoho MX/SPF records blindly;
merge SPF mechanisms if required and check DKIM/DMARC with that provider. No DNS
records were changed by this work.

## Retention decisions still required

Automatic deletion of accounts, applications, cancellation requests and registration
attempt logs is deliberately not enabled without a REKO retention decision. The
existing manual event-log cleanup covers records older than 12 months. Decide and
document purpose, retention window and responsible operator before scheduling
further deletion. No existing personal data was bulk-deleted.

Private CV/avatar access is restricted to self/admin and current pending applicants
or active allocated assignments in the same sandbox. School access ends when the
relationship is no longer active; historical bookings themselves are preserved.
Account deletion is a resumable admin job, including Storage/Auth cleanup, rather
than an attempted cross-service transaction. Repeating deletion resumes it. A partially
completed job must be retried by an admin; completed work is never republished.

## Verification run locally

- bun run test:unit: pure helper tests, excludes existing network integration test.
- bun run build, then bun run typecheck: generated routes plus production build/types.
- bun run test:db: disposable LOCAL PostgreSQL17 container; no .env/remote DB URL.
  Replays Supabase schema history and all Drizzle migrations, exercises real RLS/RPCs,
  invitations, bookings, cancellations, durable queue, deletion and concurrent overlap.
- Public UI checked in Chromium at 390px and 1280px, including Montserrat/6px fields.

Local auth/storage schemas are test doubles. They do not verify Supabase Auth email
settings, live provider delivery, backup recovery or a hosting scheduler. Those remain
release prerequisites, not passing test claims.
