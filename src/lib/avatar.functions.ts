import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnedPrivatePath } from "./private-files";
import { mapConcurrent } from "./batch-loader";

/**
 * Returns 5-minute signed URLs for substitute profile pictures.
 * Access is checked server-side with can_view_substitute(): the substitute
 * themselves, admin, or a school/teacher with an active application or booking. Others need consent (avatar_consent_at).
 */
export const getAvatarUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const ids = Array.from(new Set(data.ids));
    const permissions = await mapConcurrent(ids, 5, async (id) => {
      const { data: ok, error } = await context.supabase.rpc("can_view_substitute", {
        p_substitute: id,
      });
      return !error && ok ? id : null;
    });
    const allowed = permissions.filter((id): id is string => id !== null);
    const result: Record<string, string | null> = {};
    if (!allowed.length) return result;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, avatar_path, avatar_consent_at")
      .in("id", allowed);
    await mapConcurrent(profiles ?? [], 5, async (p) => {
      const consentOk = p.id === context.userId || !!p.avatar_consent_at;
      if (!p.avatar_path || !consentOk || !isOwnedPrivatePath(p.avatar_path, p.id)) {
        result[p.id] = null;
        return;
      }
      const { data: signed } = await supabaseAdmin.storage
        .from("avatars")
        .createSignedUrl(p.avatar_path, 300);
      result[p.id] = signed?.signedUrl ?? null;
    });
    return result;
  });
