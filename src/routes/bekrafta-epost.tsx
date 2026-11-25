import { createFileRoute, Link, type SearchSchemaInput } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { emailField } from "@/lib/contact-schemas";
import { Brand } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/bekrafta-epost")({
  validateSearch: (
    search: SearchSchemaInput & { email?: unknown; mode?: unknown; next?: unknown },
  ): { email: string; mode: "signup" | "invite"; next?: "invite" } => ({
    email: typeof search.email === "string" ? search.email : "",
    mode: search.mode === "invite" ? "invite" : "signup",
    ...(search.next === "invite" ? { next: "invite" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Bekräfta din e-post — REKO UF" },
      {
        name: "description",
        content: "Öppna länken i mejlet från REKO UF för att bekräfta din e-postadress.",
      },
      { property: "og:title", content: "Bekräfta din e-post — REKO UF" },
      {
        property: "og:description",
        content: "Öppna länken i mejlet från REKO UF för att bekräfta din e-postadress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: EmailConfirmationPage,
});

function EmailConfirmationPage() {
  const search = Route.useSearch();
  const validEmail = emailField.safeParse(search.email).success;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = window.setInterval(() => setRetryAfter((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [retryAfter]);

  async function resend() {
    if (!validEmail || busy || retryAfter > 0) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      if (search.mode === "invite") {
        const { error: authError } = await supabase.auth.signInWithOtp({
          email: search.email,
          options: {
            emailRedirectTo: new URL("/inbjudan", window.location.origin).href,
            shouldCreateUser: true,
          },
        });
        if (authError) throw authError;
      } else {
        const callback = new URL("/auth", window.location.origin);
        if (search.next) callback.searchParams.set("next", search.next);
        const { error: authError } = await supabase.auth.resend({
          type: "signup",
          email: search.email,
          options: { emailRedirectTo: callback.href },
        });
        if (authError) throw authError;
      }
      setStatus("Ett nytt mejl har skickats. Kontrollera även skräpposten.");
      setRetryAfter(60);
    } catch {
      setError("Kunde inte skicka mejlet igen just nu. Vänta en stund och försök på nytt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <Brand />
      <Card className="w-full max-w-md shadow-lift">
        <CardHeader>
          <CardTitle className="text-2xl">Kontrollera din e-post</CardTitle>
          <CardDescription>
            {search.mode === "invite"
              ? "Bekräfta din e-postadress innan du fortsätter med inbjudan."
              : "Bekräfta din e-postadress för att aktivera ditt konto."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {validEmail ? (
            <>
              <p>
                Vi har skickat ett mejl till <strong>{search.email}</strong>. Öppna länken i mejlet
                för att fortsätta. Kontrollera även skräpposten.
              </p>
              {status && (
                <p role="status" className="text-sm text-success">
                  {status}
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={busy || retryAfter > 0}
                onClick={resend}
              >
                {busy
                  ? "Skickar…"
                  : retryAfter > 0
                    ? `Skicka igen om ${retryAfter} sekunder`
                    : "Skicka mejlet igen"}
              </Button>
            </>
          ) : (
            <p role="alert">
              E-postadressen saknas eller är ogiltig. Gå tillbaka och skicka bekräftelsemejlet på
              nytt.
            </p>
          )}
          <Button asChild variant="ghost" className="min-h-11">
            <Link to={search.mode === "invite" ? "/inbjudan" : "/auth"}>
              {search.mode === "invite" ? "Tillbaka till inbjudan" : "Till inloggningen"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
