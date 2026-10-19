import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { teacherRegistrationSchema } from "./contact-schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashCode(code: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(code.trim().toUpperCase()), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}
function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}
async function assertAdmin(supabase: { rpc: (fn: "is_admin") => PromiseLike<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_admin");
  if (!data) throw new Error("Endast admin");
}

export const generateSchoolCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ schoolId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = randomCode();
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    const code_hash = await hashCode(code, salt);
    const { error } = await supabaseAdmin.from("school_codes").upsert({
      school_id: data.schoolId, code_hash, salt, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Kunde inte spara koden");
    return { code };
  });

export const listSchoolsForSignup = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("schools").select("id, name").order("name");
  return data ?? [];
});

export const registerTeacher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => teacherRegistrationSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = (getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "unknown")
      .split(",")[0]!.trim();
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("teacher_code_attempts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .or(`email.eq.${data.email},ip.eq.${ip}`);
    if ((count ?? 0) >= MAX_ATTEMPTS) {
      return { ok: false as const, error: `För många felaktiga försök. Vänta ${WINDOW_MINUTES} minuter och försök igen.` };
    }

    const { data: row } = await supabaseAdmin
      .from("school_codes").select("code_hash, salt").eq("school_id", data.schoolId).maybeSingle();
    const valid = !!row && (await hashCode(data.code, row.salt)) === row.code_hash;
    if (!valid) {
      await supabaseAdmin.from("teacher_code_attempts").insert({ email: data.email, ip });
      return { ok: false as const, error: "Fel skolkod. Kontrollera koden med din skola." };
    }

    const { data: school } = await supabaseAdmin.from("schools").select("name").eq("id", data.schoolId).maybeSingle();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) {
      console.error("registerTeacher createUser failed:", error?.message, error);
      const exists = error?.message?.toLowerCase().includes("already");
      return { ok: false as const, error: exists ? "Det finns redan ett konto med den e-postadressen." : "Kunde inte skapa kontot." };
    }
    const uid = created.user.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: profileError } = await supabaseAdmin.from("profiles")
      .update({ full_name: data.fullName, email: data.email, phone: data.phone, school_name: school?.name ?? null })
      .eq("id", uid);
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      return { ok: false as const, error: "Kunde inte spara kontaktuppgifterna." };
    }
    const { error: mErr } = await supabaseAdmin
      .from("school_members").insert({ user_id: uid, school_id: data.schoolId, member_type: "teacher" });
    if (mErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      return { ok: false as const, error: "Kunde inte koppla kontot till skolan." };
    }
    return { ok: true as const };
  });

export const listTeachers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members } = await supabaseAdmin
      .from("school_members").select("user_id, school_id, created_at, schools(name)").eq("member_type", "teacher");
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email, phone").in("id", ids)
      : { data: [] };
    return (members ?? []).map((m) => {
      const p = profiles?.find((x) => x.id === m.user_id);
      return {
        userId: m.user_id,
        schoolName: (m.schools as { name: string } | null)?.name ?? "—",
        name: p?.full_name ?? "",
        email: p?.email ?? "",
        phone: p?.phone ?? "",
      };
    });
  });

export const removeTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("school_members").delete().eq("user_id", data.userId).eq("member_type", "teacher");
    if (error) throw new Error("Kunde inte ta bort läraren");
    return { ok: true };
  });
