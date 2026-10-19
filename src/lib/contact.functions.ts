import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { contactShape, schoolContactSchema, substituteContactSchema } from "./contact-schemas";

export const saveSchoolContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schoolContactSchema.extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("is_admin");
    if (roleError || !admin) throw new Error("Endast admin kan ändra skoluppgifter");
    const { id, ...contact } = data;
    const query = id ? context.supabase.from("schools").update(contact).eq("id", id) : context.supabase.from("schools").insert(contact);
    const { error } = await query;
    if (error) throw new Error("Kunde inte spara skoluppgifterna");
    return { ok: true };
  });

export const saveProfileContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.record(z.unknown()).parse(d))
  .handler(async ({ data, context }) => {
    const { data: schoolId, error: schoolError } = await context.supabase.rpc("my_school_id");
    if (schoolError) throw new Error("Kunde inte kontrollera kontot");
    const parsed = schoolId ? z.object(contactShape).safeParse(data) : substituteContactSchema.safeParse(data);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Kontrollera uppgifterna");
    const { error } = await context.supabase.from("profiles").update(parsed.data).eq("id", context.userId);
    if (error) throw new Error("Kunde inte spara profilen. Kontrollera kontaktuppgifterna.");
    return { ok: true };
  });