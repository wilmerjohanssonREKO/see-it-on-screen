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
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-bold text-foreground">
          Så hanterar vi dina uppgifter
        </h2>
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          Vi sparar namn, kontaktuppgifter, adress (för avstånd till skolor),
          ditt CV om du laddar upp det, samt en pseudonymiserad logg
          över hur tjänsten används. Uppgifterna delas bara med skolor du
          anmält dig till.
        </p>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Läs mer i{" "}
          <a
            href="/integritetspolicy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline underline-offset-2"
          >
            REKO UF:s integritetspolicy
          </a>
          .
        </p>
        <Button
          className="mt-5 w-full"
          onClick={approve}
          disabled={saving}
        >
          {saving ? "Sparar…" : "Jag har läst integritetspolicyn"}
        </Button>
      </div>
    </div>
  );
}
