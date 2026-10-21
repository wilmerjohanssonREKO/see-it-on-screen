import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnedPrivatePath } from "./private-files";

/**
 * For the school page: returns a 60-second signed URL for the CV of the
 * substitute assigned to one of the caller's own school assignments.
 * Returns null when there is no CV or no consent — the UI then hides the
 * button. Admin may use it for any assignment.
 */
export const getCvForAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ assignmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: assignment } = await supabase
      .from("assignments")
      .select("school_id, assigned_substitute_id")
      .eq("id", data.assignmentId)
      .maybeSingle();
    if (!assignment?.assigned_substitute_id) return { url: null };

    const { data: canManage } = await supabase.rpc("can_manage_school", {
      p_school: assignment.school_id,
    });
    if (!canManage) throw new Error("Du har inte behörighet att läsa detta CV");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("cv_file_path, cv_consent_at")
      .eq("id", assignment.assigned_substitute_id)
      .maybeSingle();
    if (!profile?.cv_file_path || !profile.cv_consent_at) return { url: null };
    if (!isOwnedPrivatePath(profile.cv_file_path, assignment.assigned_substitute_id)) return { url: null };

    const { data: signed, error } = await supabaseAdmin.storage
      .from("cvs")
      .createSignedUrl(profile.cv_file_path, 60);
    if (error || !signed) return { url: null };
    return { url: signed.signedUrl };
  });
