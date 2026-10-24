import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnedPrivatePath } from "./private-files";

/**
 * Returns 5-minute signed URLs for substitute profile pictures.
 * Access is checked server-side with can_view_substitute(): the substitute
 * themselves, admin, or a school/teacher whose school has an assignment the
 * substitute took or was declined from. Others need consent (avatar_consent_at).
 */
export const getAvatarUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ids = Array.from(new Set(data.ids));
    const allowed: string[] = [];
    for (const id of ids) {
      const { data: ok } = await context.supabase.rpc("can_view_substitute", { p_substitute: id });
      if (ok) allowed.push(id);
    }
    const result: Record<string, string | null> = {};
    if (!allowed.length) return result;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, avatar_path, avatar_consent_at")
      .in("id", allowed);
    for (const p of profiles ?? []) {
      const consentOk = p.id === context.userId || !!p.avatar_consent_at;
      if (!p.avatar_path || !consentOk || !isOwnedPrivatePath(p.avatar_path, p.id)) {
        result[p.id] = null;
        continue;
      }
      const { data: signed } = await supabaseAdmin.storage
        .from("avatars")
        .createSignedUrl(p.avatar_path, 300);
      result[p.id] = signed?.signedUrl ?? null;
    }
    return result;
  });
