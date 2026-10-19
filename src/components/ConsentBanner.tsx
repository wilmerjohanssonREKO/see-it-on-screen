import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Visar en samtyckesruta för inloggade användare tills de godkänt att
 * REKO UF lagrar och behandlar deras uppgifter. Kan inte stängas utan
 * att godkännas — rutan ligger kvar tills profiles.consent_at är satt.
 */
export function ConsentBanner({ userId }: { userId: string }) {
  const [needsConsent, setNeedsConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("profiles")
      .select("consent_at")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setNeedsConsent(!data?.consent_at);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!needsConsent) return null;

  const approve = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("set_profile_consent");
    setSaving(false);
    if (!error) setNeedsConsent(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-bold text-foreground">
          Samtycke till lagring av uppgifter
        </h2>
        <div className="mt-3 space-y-2 text-sm font-medium text-muted-foreground">
          <p>
            För att REKO UF ska fungera lagrar och behandlar vi uppgifter om
            dig: namn, kontaktuppgifter, adress (används för att räkna ut
            avstånd till skolor), CV och utdrag ur belastningsregister.
          </p>
          <p>
            Vi loggar också hur tjänsten används — till exempel när ett
            vikariebehov publiceras, öppnas och tillsätts — för att kunna
            förbättra matchningen. Loggen är pseudonymiserad och innehåller
            inga namn, mejladresser eller telefonnummer.
          </p>
          <p>
            Uppgifterna delas bara med skolor du anmält dig till, och bara
            enligt de samtycken du gett. Du kan när som helst ta bort ditt
            konto och dina uppgifter.
          </p>
        </div>
        <Button
          className="mt-5 w-full"
          onClick={approve}
          disabled={saving}
        >
          {saving ? "Sparar…" : "Jag godkänner att REKO UF lagrar och behandlar mina uppgifter"}
        </Button>
      </div>
    </div>
  );
}
