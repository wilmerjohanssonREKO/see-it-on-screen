import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnedPrivatePath } from "./private-files";

/**
 * Returns a 60-second signed URL for a substitute's CV.
 * Access rules (enforced here, server-side — never only in the browser):
 *  - the substitute themselves
 *  - admin
 *  - school/teacher accounts whose school has an assignment the substitute
 *    is notified about or assigned to
 * The CV must exist and the substitute must have consented (cv_consent_at).
 */
export const getCvSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ substituteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const targetId = data.substituteId;

    let allowed = targetId === userId;

    if (!allowed) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      allowed = !!isAdmin;
    }

    if (!allowed) {
      const { data: canView, error } = await supabase.rpc("can_view_substitute", { p_substitute: targetId });
      allowed = !error && canView === true;
    }

    if (!allowed) throw new Error("Du har inte behörighet att läsa detta CV");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles")
      .select("cv_file_path, cv_consent_at").eq("id", targetId).maybeSingle();
    if (!profile?.cv_file_path || !profile.cv_consent_at) throw new Error("Vikarien har inte laddat upp något CV");
    if (!isOwnedPrivatePath(profile.cv_file_path, targetId)) throw new Error("Kunde inte öppna CV:t");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("cvs")
      .createSignedUrl(profile.cv_file_path, 60);
    if (error || !signed) throw new Error("Kunde inte öppna CV:t");
    return { url: signed.signedUrl };
  });
