import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const provisionRequestedTestSubstitute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("is_admin");
    if (roleError || !isAdmin) throw new Error("Endast admin kan skapa testkontot");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = `Reko-${crypto.randomUUID()}!`;
    const email = "vikarie.test.20261021@example.com";
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Testvikarie REKO" },
    });
    if (error || !data.user) throw new Error("Kunde inte skapa testkontot");
    return { email, password, userId: data.user.id };
  });

export const deleteUserCompletely = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Endast admin kan ta bort användare");
    if (data.userId === context.userId) throw new Error("Du kan inte ta bort dig själv");

    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const id = data.userId;

    // Free up assignments this person held, then remove everything linked to them
    await db.from("assignments")
      .update({ status: "open", assigned_substitute_id: null, assigned_at: null })
      .eq("assigned_substitute_id", id).eq("status", "filled");
    await db.from("assignments").update({ assigned_substitute_id: null }).eq("assigned_substitute_id", id);
    await db.from("notifications").delete().eq("substitute_id", id);
    await db.from("ratings").delete().eq("substitute_id", id);
    await db.from("feedback").delete().eq("user_id", id);
    await db.from("school_members").delete().eq("user_id", id);
    await db.from("user_roles").delete().eq("user_id", id);

    const { data: files } = await db.storage.from("background-checks").list(id);
    if (files?.length) {
      await db.storage.from("background-checks").remove(files.map((f) => `${id}/${f.name}`));
    }
    const { data: cvFiles } = await db.storage.from("cvs").list(id);
    if (cvFiles?.length) {
      await db.storage.from("cvs").remove(cvFiles.map((f) => `${id}/${f.name}`));
    }

    const { error: pErr } = await db.from("profiles").delete().eq("id", id);
    if (pErr) throw new Error(pErr.message);
    const { error } = await db.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });
