import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  schoolId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

export const createSchoolLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Endast admin kan skapa skolinlogg");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: school } = await supabaseAdmin
      .from("schools").select("name").eq("id", data.schoolId).maybeSingle();
    if (!school) throw new Error("Skolan finns inte");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: school.name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Kunde inte skapa inlogg");

    const uid = created.user.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("profiles").update({ school_name: school.name }).eq("id", uid);
    const { error: mErr } = await supabaseAdmin
      .from("school_members").insert({ user_id: uid, school_id: data.schoolId });
    if (mErr) throw new Error(mErr.message);
    return { ok: true };
  });
