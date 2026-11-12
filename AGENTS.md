<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep public school onboarding on the information-only `/kontakt` route; leave authenticated school publishing and account creation separate so public visitors cannot submit assignment requests.
- Retire the school-request admin view without migrations or data deletion to preserve historical requests.
- School and teacher accounts join through admin-created, expiring, one-use personal invitations bound to verified email and sandbox. Never restore public shared-school-code registration or auto-confirm arbitrary emails. Preserve existing memberships.

- Keep retired MVP test tools, substitute ratings/statistics and admin promotion out of the UI; preserve historical data and use the shared `/auth` login for every account type.

- Share contact validation in `contact-schemas.ts`, persist contact edits through authenticated `contact.functions.ts`, and mirror essential checks in database triggers; legacy auth-created profiles stay valid until contact completion.
- Home addresses are private profile details and must not be included in school-facing assignment reads.
- Private CV/avatar signing must authorize the caller and validate the stored path belongs to its profile owner; notification delivery alone never authorizes school CV access.
- Exported user-supplied CSV strings must be neutralized against spreadsheet formulas while numeric metrics stay numeric.
- Schools/teachers create, publish and decline assignments only via SECURITY DEFINER RPCs (create_and_publish_assignment, decline_substitute) guarded by can_manage_school(); they have no direct write policies on assignments, so they cannot reassign or alter claims.
- Matchning: godkända vikarier anmäler intresse; skolan väljer bland sökande via select_applicant. Legacy claim_assignment registrerar bara intresse. All allocation checks future Stockholm time, sandbox and concurrency-safe non-overlap; skolkontakt bara för tilldelad vikarie. Use paged list RPCs. Betyg sätts bara via RPC rate_substitute/rate_school efter genomfört uppdrag; profilbilder visas via signerade URL:er från avatar.functions.ts med can_view_substitute()-kontroll — så behörigheten inte går att kringgå i webbläsaren.
- Loggsystem: event_log skrivs bara via SECURITY DEFINER-triggers/funktioner (log_event), aldrig från klienten. Pseudonym = HMAC av användar-id med nyckel i log_config (inga grants till app-roller). pgcrypto-funktioner måste schema-kvalificeras (extensions.gen_random_bytes/hmac) eftersom funktionerna sätter search_path=public. Admin läser via admin_assignment_metrics()/admin_event_log(), gallring via purge_old_event_log() — alla kontrollerar is_admin() internt. notification_viewed loggas via RPC log_assignment_view från uppdrag.tsx (enda klientinitierade loggen, men skrivningen sker fortfarande server-side).
- Admin page tabs live one per file in src/components/admin/*Tab.tsx; the route file only composes them, keeping files small enough to edit safely.
- AppHeader owns the mobile navigation disclosure; profile file pickers use real buttons and refs, keeping keyboard access and existing upload guards together.
- Use separate 6px panel, button and field radius tokens. Inputs, textareas and select triggers match the same profile; preserve badges, logo and avatars.
- Sandbox isolation uses admin-controlled schools.is_test/profiles.is_test; mode changes are blocked for schools with assignments and profiles with assignment history or school membership so historical relationships cannot cross modes. same_sandbox() fails closed for missing owners and gates matching, claims, related reads and private-file authorization; email recipient checks fail closed and test matches are captured without provider calls. Purging only targets test-school assignment IDs to preserve real history.

- Private queries are scoped to the current user/school; clear/cancel them on identity changes. Never reuse another account's cached data.
- Booking/cancellation transitions enqueue durable versioned email jobs transactionally; browser actions never drive delivery. Workers recheck recipients/test mode and require admin or cron authentication.
- Cancellation is requested by a party and resolved by REKO admin. Only future work may reopen; clear assignment identity/time atomically. Preserve completed history during resumable account deletion.
- Read docs/rollout.md before merging into the Lovable-connected branch. Local SQL tests must use the disposable container and never the original test-named accounts or production database.
