import { supabase } from "@/integrations/supabase/client";
/** One role/profile decision for sign-in, sign-up and OAuth return. */
export async function postAuthDestination(): Promise<"/admin" | "/skola" | "/profil" | "/uppdrag"> {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user)
    throw new Error("Kunde inte kontrollera inloggningen. Försök igen.");
  const [{ data: admin, error: adminError }, { data: school, error: schoolError }] =
    await Promise.all([supabase.rpc("is_admin"), supabase.rpc("my_school_id")]);
  if (adminError || schoolError)
    throw new Error("Kunde inte kontrollera kontots behörighet. Försök igen.");
  if (admin) return "/admin";
  if (school) return "/skola";
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name,phone,street_address,postal_code,city")
    .eq("id", userResult.user.id)
    .maybeSingle();
  if (error) throw new Error("Kunde inte hämta profilen. Försök igen.");
  return profile?.full_name &&
    profile.phone &&
    profile.street_address &&
    profile.postal_code &&
    profile.city
    ? "/uppdrag"
    : "/profil";
}
