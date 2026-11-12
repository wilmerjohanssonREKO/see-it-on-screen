import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailField, nameField, phoneField } from "./contact-schemas";

type InvitationRow = {
  id: string;
  school_id: string;
  email: string;
  member_type: "school" | "teacher";
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};
const inviteInput = z.object({
  schoolId: z.string().uuid(),
  email: emailField.transform((v) => v.toLowerCase()),
  memberType: z.enum(["school", "teacher"]),
});
async function assertAdmin(supabase: {
  rpc: (fn: "is_admin") => PromiseLike<{ data: unknown; error?: unknown }>;
}) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error || !data) throw new Error("Endast admin");
}
/** Public shared-code signup is deliberately no longer a server function. */
export const createSchoolInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => inviteInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: school, error: schoolError } = await db
      .from("schools")
      .select("id,name,is_test")
      .eq("id", data.schoolId)
      .single();
    if (schoolError || !school) throw new Error("Kunde inte kontrollera skolan");
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const { data: id, error } = await context.supabase.rpc(
      "create_school_invitation" as never,
      {
        p_school_id: data.schoolId,
        p_email: data.email,
        p_member_type: data.memberType,
        p_token_hash: hash,
      } as never,
    );
    if (error || !id) throw new Error("Kunde inte skapa inbjudan");
    try {
      if (school.is_test) {
        // Never persist a bearer invitation token in the sandbox inbox or response.
        const { error: captureError } = await db
          .from("sandbox_emails")
          .insert({
            template: "school-invitation",
            recipient: data.email,
            data: {
              schoolName: school.name,
              memberType: data.memberType,
              invitationId: id,
              sandbox: true,
              linkOmitted: true,
            },
          } as never);
        if (captureError) throw new Error("Kunde inte fånga testinbjudan");
        return { ok: true, delivery: "sandbox" as const };
      }
      const configured = process.env["REKO_PUBLIC_URL"];
      if (!configured)
        throw new Error("REKO_PUBLIC_URL behöver konfigureras innan inbjudningar kan skickas");
      const origin = new URL(configured);
      if (
        origin.protocol !== "https:" ||
        origin.username ||
        origin.password ||
        origin.pathname !== "/" ||
        origin.search ||
        origin.hash
      )
        throw new Error("REKO_PUBLIC_URL ska vara webbplatsens HTTPS-origin");
      const url = new URL("/inbjudan", origin.origin);
      url.hash = new URLSearchParams({ token }).toString();
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      const outcome = await sendTemplateEmail("school-invitation", data.email, {
        templateData: { schoolName: school.name, memberType: data.memberType, inviteUrl: url.href },
        idempotencyKey: `school-invitation-${id}`,
        replyTo: "hej@rekoweb.com",
      });
      if (!outcome.sent) throw new Error("Inbjudan kunde inte levereras");
      return { ok: true, delivery: "sent" as const };
    } catch (error) {
      await context.supabase.rpc(
        "revoke_school_invitation" as never,
        { p_invitation_id: id } as never,
      );
      // No provider errors: they may include the invitation URL or email payload.
      throw new Error(
        error instanceof Error && error.message.startsWith("REKO_PUBLIC_URL")
          ? error.message
          : "Inbjudan kunde inte skickas. Länken har spärrats; kontrollera mejlinställningarna och försök igen.",
      );
    }
  });

export const listSchoolInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InvitationRow[]> => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data, error } = await db
      .from("school_invitations" as never)
      .select("id,school_id,email,member_type,created_at,expires_at,accepted_at,revoked_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Kunde inte hämta inbjudningar");
    return (data ?? []) as unknown as InvitationRow[];
  });
export const revokeSchoolInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "revoke_school_invitation" as never,
      { p_invitation_id: data.id } as never,
    );
    if (error) throw new Error("Kunde inte återkalla inbjudan");
    return { ok: true };
  });
export const acceptSchoolInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({ token: z.string().regex(/^[0-9a-f]{64}$/), fullName: nameField, phone: phoneField })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "accept_school_invitation" as never,
      { p_token: data.token, p_full_name: data.fullName, p_phone: data.phone } as never,
    );
    if (error)
      throw new Error(
        "Inbjudan kunde inte accepteras. Kontrollera att rätt e-postadress är verifierad och att länken inte är använd eller utgången. Kontakta REKO om felet kvarstår.",
      );
    return { ok: true };
  });

export const listTeachers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: members, error } = await db
      .from("school_members")
      .select("user_id,school_id,schools(name)")
      .eq("member_type", "teacher")
      .limit(500);
    if (error) throw new Error("Kunde inte hämta lärare");
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles, error: profileError } = ids.length
      ? await db.from("profiles").select("id,full_name,email,phone").in("id", ids)
      : { data: [], error: null };
    if (profileError) throw new Error("Kunde inte hämta läraruppgifter");
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (members ?? []).map((m) => {
      const p = byId.get(m.user_id);
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
  .validator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db
      .from("school_members")
      .delete()
      .eq("user_id", data.userId)
      .eq("member_type", "teacher");
    if (error) throw new Error("Kunde inte ta bort läraren");
    return { ok: true };
  });
export const inspectSchoolInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ token: z.string().regex(/^[0-9a-f]{64}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc(
      "inspect_school_invitation" as never,
      { p_token: data.token } as never,
    );
    const row = (
      rows as unknown as
        { school_name: string; member_type: string; has_password: boolean }[] | null
    )?.[0];
    if (error || !row)
      throw new Error(
        "Inbjudan är ogiltig, använd, utgången eller avsedd för en annan e-postadress.",
      );
    return row;
  });
