import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { needsAnswer, onConsentChange, readChoice, saveChoices } from "@/lib/consent";
import { Button } from "@/components/ui/button";

export const OPEN_COOKIE_SETTINGS = "reko-open-cookie-settings";

export function AnalyticsConsentBanner() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const gpc = typeof navigator !== "undefined" && (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

  useEffect(() => {
    void needsAnswer(["analytics"]).then((n) => n && setOpen(true));
    const openSettings = () => {
      setAnalytics(readChoice("analytics") === "granted");
      setSettings(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS, openSettings);
    const off = onConsentChange(() => setAnalytics(readChoice("analytics") === "granted"));
    return () => {
      window.removeEventListener(OPEN_COOKIE_SETTINGS, openSettings);
      off();
    };
  }, []);

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open, settings]);

  if (!open) return null;
  const answer = (choice: "granted" | "denied") => {
    saveChoices({ analytics: choice });
    setOpen(false);
    setSettings(false);
  };

  return (
    <div
      ref={panel}
      tabIndex={-1}
      role="region"
      aria-label="Cookie-inställningar"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-panel border border-border bg-card p-4 shadow-lift outline-hidden sm:inset-x-auto sm:right-4"
    >
      {!settings ? (
        <>
          <p className="font-semibold">Hjälp oss förbättra REKO UF</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Om du godkänner mäter vi anonymt hur sidan används — vilka sidor du besöker, var du klickar och hur långt du scrollar. Vi sparar aldrig vad du skriver i formulär och kopplar inte mätningen till dig.{" "}
            <Link to="/integritetspolicy" className="text-primary underline underline-offset-2">Läs integritetspolicyn</Link>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => answer("denied")}>Avvisa alla</Button>
            <Button variant="outline" className="min-h-11" onClick={() => answer("granted")}>Godkänn alla</Button>
          </div>
          <Button variant="ghost" className="mt-2 min-h-11 w-full" onClick={() => setSettings(true)}>Cookie-inställningar</Button>
        </>
      ) : (
        <>
          <p className="font-semibold">Cookie-inställningar</p>
          {gpc && <p className="mt-1 text-sm text-muted-foreground">Din webbläsare ber sidor att inte spåra dig, så analys är avstängd.</p>}
          <div className="mt-3 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span><strong>Nödvändiga</strong> — inloggning och att sidan fungerar. Alltid på.</span>
            </div>
            <label className="flex items-center justify-between gap-3">
              <span><strong>Analys</strong>, tillhandahålls av REKO UF och Lovable — anonym mätning av besök och klick.</span>
              <input type="checkbox" role="switch" className="h-5 w-5 shrink-0 accent-primary" checked={!gpc && analytics} disabled={gpc} onChange={(e) => setAnalytics(e.target.checked)} />
            </label>
          </div>
          <Button className="mt-3 min-h-11 w-full" onClick={() => answer(analytics ? "granted" : "denied")}>Spara val</Button>
        </>
      )}
    </div>
  );
}
