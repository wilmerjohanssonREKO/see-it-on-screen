import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { contactShape, schoolContactSchema, substituteContactSchema } from "./contact-schemas";
import { geocodePostalCode } from "./geo.server";

/**
 * Looks up coordinates for a postal code + city. Returns the fields to
 * store: fresh coordinates, or nulls when the lookup fails so a changed
 * address never keeps stale coordinates.
 */
async function coordsFor(postalCode: string | null | undefined, city: string | null | undefined) {
  if (!postalCode || !city) return { lat: null, lng: null, geoWarning: false };
  const hit = await geocodePostalCode(postalCode, city);
  if (!hit) return { lat: null, lng: null, geoWarning: true };
  return { lat: hit.lat, lng: hit.lng, geoWarning: false };
}

export const saveSchoolContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    schoolContactSchema.extend({ id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("is_admin");
    if (roleError || !admin) throw new Error("Endast admin kan ändra skoluppgifter");
    const { id, ...contact } = data;
    const { lat, lng, geoWarning } = await coordsFor(contact.postal_code, contact.city);
    const payload = { ...contact, lat, lng };
    const query = id
      ? context.supabase.from("schools").update(payload).eq("id", id)
      : context.supabase.from("schools").insert(payload);
    const { error } = await query;
    if (error) throw new Error("Kunde inte spara skoluppgifterna");
    return { ok: true, geoWarning };
  });

export const saveProfileContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.record(z.unknown()).parse(d))
  .handler(async ({ data, context }) => {
    const { data: schoolId, error: schoolError } = await context.supabase.rpc("my_school_id");
    if (schoolError) throw new Error("Kunde inte kontrollera kontot");
    const parsed = schoolId
      ? z.object(contactShape).safeParse(data)
      : substituteContactSchema.safeParse(data);
    if (!parsed.success)
      throw new Error(parsed.error.issues[0]?.message ?? "Kontrollera uppgifterna");
    const { postal_code, city } = parsed.data as { postal_code?: string | null; city?: string | null };
    const { lat, lng, geoWarning } = await coordsFor(postal_code, city);
    const { error } = await context.supabase
      .from("profiles")
      .update({ ...parsed.data, lat, lng })
      .eq("id", context.userId);
    if (error) throw new Error("Kunde inte spara profilen. Kontrollera kontaktuppgifterna.");
    return { ok: true, geoWarning };
  });
