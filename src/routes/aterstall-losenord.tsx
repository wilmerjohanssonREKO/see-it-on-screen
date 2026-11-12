import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const Route = createFileRoute("/aterstall-losenord")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Välj nytt lösenord — REKO UF" }, { name: "referrer", content: "no-referrer" }],
  }),
  component: ResetPassword,
});
function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (active) {
        setSignedIn(!!data.session && !sessionError);
        setReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password.length < 8 || password.length > 72) {
      setError("Lösenordet ska innehålla 8–72 tecken");
      return;
    }
    if (password !== String(fd.get("confirm") ?? "")) {
      setError("Lösenorden måste vara lika");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      await supabase.auth.signOut();
      setDone(true);
    } catch {
      setError(
        "Länken kan ha gått ut eller lösenordet kunde inte sparas. Begär en ny återställningslänk.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <Brand />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Välj nytt lösenord</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {done ? (
            <p role="status">Lösenordet är uppdaterat. Logga in med ditt nya lösenord.</p>
          ) : !ready ? (
            <p>Kontrollerar länken…</p>
          ) : !signedIn ? (
            <p>
              Återställningslänken saknas eller har gått ut. Begär en ny via ”Glömt lösenord?” på
              inloggningssidan.
            </p>
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              <Label htmlFor="reset-password">Nytt lösenord</Label>
              <Input
                id="reset-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
              />
              <Label htmlFor="reset-confirm">Bekräfta lösenord</Label>
              <Input
                id="reset-confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
              />
              <Button disabled={busy}>{busy ? "Sparar…" : "Spara nytt lösenord"}</Button>
            </form>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Link to="/auth" className="underline">
            Till inloggningen
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
