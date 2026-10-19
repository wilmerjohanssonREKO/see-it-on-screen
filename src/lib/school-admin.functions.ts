import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { schoolContactSchema } from "./contact-schemas";
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
      .from("schools")
      .select("*")
      .eq("id", data.schoolId)
      .maybeSingle();
    if (!school) throw new Error("Skolan finns inte");
    if (!schoolContactSchema.safeParse(school).success)
      throw new Error("Fyll i skolans kontaktuppgifter och adress innan du skapar inlogg.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: school.name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Kunde inte skapa inlogg");

    const uid = created.user.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ school_name: school.name })
      .eq("id", uid);
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error("Kunde inte spara skolkontot");
    }
    const { error: mErr } = await supabaseAdmin
      .from("school_members")
      .insert({ user_id: uid, school_id: data.schoolId });
    if (mErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error("Kunde inte koppla kontot till skolan");
    }
    return { ok: true };
  });
