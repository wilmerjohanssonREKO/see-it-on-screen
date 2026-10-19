import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("cv_file_path, cv_consent_at")
      .eq("id", targetId)
      .maybeSingle();

    if (!profile?.cv_file_path || !profile.cv_consent_at) {
      throw new Error("Vikarien har inte laddat upp något CV");
    }

    let allowed = targetId === userId;

    if (!allowed) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      allowed = !!isAdmin;
    }

    if (!allowed) {
      const { data: mySchool } = await supabase.rpc("my_school_id");
      if (mySchool) {
        const { data: related } = await supabase
          .from("assignments")
          .select("id")
          .eq("school_id", mySchool)
          .or(`assigned_substitute_id.eq.${targetId}`);
        // RLS already scopes what the caller can see; also check notifications
        const { data: notified } = await supabase
          .from("notifications")
          .select("id")
          .eq("substitute_id", targetId);
        if ((related?.length ?? 0) > 0) allowed = true;
        if (!allowed && (notified?.length ?? 0) > 0) {
          // verify at least one notified assignment belongs to my school
          const { data: mine } = await supabase
            .from("assignments")
            .select("id, notifications!inner(id)")
            .eq("school_id", mySchool)
            .eq("notifications.substitute_id", targetId)
            .limit(1);
          allowed = (mine?.length ?? 0) > 0;
        }
      }
    }

    if (!allowed) throw new Error("Du har inte behörighet att läsa detta CV");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("cvs")
      .createSignedUrl(profile.cv_file_path, 60);
    if (error || !signed) throw new Error("Kunde inte öppna CV:t");
    return { url: signed.signedUrl };
  });
