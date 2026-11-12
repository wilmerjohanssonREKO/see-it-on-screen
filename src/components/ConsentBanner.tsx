import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Visar en samtyckesruta för inloggade användare tills de godkänt att
 * REKO UF lagrar och behandlar deras uppgifter. Kan inte stängas utan
 * att godkännas — rutan ligger kvar tills profiles.consent_at är satt.
 */
export function ConsentBanner({ userId }: { userId: string }) {
  const [needsConsent, setNeedsConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (needsConsent && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [needsConsent]);

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
    if (error) {
      toast.error("Kunde inte spara. Försök igen.");
      return;
    }
    setNeedsConsent(false);
  };

  return (
    <dialog
      ref={dialog}
      onCancel={event => event.preventDefault()}
      aria-labelledby="consent-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-panel border bg-card p-6 text-foreground shadow-lg backdrop:bg-foreground/40"
    >
        <h2 id="consent-title" className="text-lg font-bold text-foreground">
          Så hanterar vi dina uppgifter
        </h2>
        <a
          href="/integritetspolicy"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-primary underline underline-offset-2"
        >
          Läs REKO UF:s integritetspolicy
        </a>
        <Button
          className="mt-5 w-full"
          onClick={approve}
          disabled={saving}
        >
          {saving ? "Sparar…" : "Jag har läst och accepterar integritetspolicyn"}
        </Button>
        <Button variant="ghost" className="mt-2 w-full" disabled={saving} onClick={async () => {
          const { error } = await supabase.auth.signOut();
          if (error) toast.error("Kunde inte logga ut. Försök igen.");
        }}>Logga ut</Button>
    </dialog>
  );
}
