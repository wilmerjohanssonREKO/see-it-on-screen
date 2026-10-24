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
- Teacher accounts are school_members rows with member_type='teacher'; school codes are PBKDF2-hashed in school_codes and verified only in server functions (teacher.functions.ts), so the code check cannot be bypassed in the browser.

- Keep retired MVP test tools, substitute ratings/statistics and admin promotion out of the UI; preserve historical data and use the shared `/auth` login for every account type.

- Share contact validation in `contact-schemas.ts`, persist contact edits through authenticated `contact.functions.ts`, and mirror essential checks in database triggers; legacy auth-created profiles stay valid until contact completion.
- Home addresses are private profile details and must not be included in school-facing assignment reads.
- Private CV/avatar signing must authorize the caller and validate the stored path belongs to its profile owner; notification delivery alone never authorizes school CV access.
- Exported user-supplied CSV strings must be neutralized against spreadsheet formulas while numeric metrics stay numeric.
- Schools/teachers create, publish and decline assignments only via SECURITY DEFINER RPCs (create_and_publish_assignment, decline_substitute) guarded by can_manage_school(); they have no direct write policies on assignments, so they cannot reassign or alter claims.
- Matchning: alla godkända vikarier ser alla öppna annonser via RPC substitute_assignments() (skolkontakt bara för tilldelad vikarie); ingen ämnes- eller avståndsfiltrering. Betyg sätts bara via RPC rate_substitute/rate_school efter genomfört uppdrag; profilbilder visas via signerade URL:er från avatar.functions.ts med can_view_substitute()-kontroll — så behörigheten inte går att kringgå i webbläsaren.
- Loggsystem: event_log skrivs bara via SECURITY DEFINER-triggers/funktioner (log_event), aldrig från klienten. Pseudonym = HMAC av användar-id med nyckel i log_config (inga grants till app-roller). pgcrypto-funktioner måste schema-kvalificeras (extensions.gen_random_bytes/hmac) eftersom funktionerna sätter search_path=public. Admin läser via admin_assignment_metrics()/admin_event_log(), gallring via purge_old_event_log() — alla kontrollerar is_admin() internt. notification_viewed loggas via RPC log_assignment_view från uppdrag.tsx (enda klientinitierade loggen, men skrivningen sker fortfarande server-side).
- Admin page tabs live one per file in src/components/admin/*Tab.tsx; the route file only composes them, keeping files small enough to edit safely.
