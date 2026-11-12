import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { acceptSchoolInvitation, inspectSchoolInvitation } from "@/lib/teacher.functions";
import { INVITATION_STORAGE_KEY, invitationToken } from "@/lib/auth-navigation";
import { nameField, phoneField } from "@/lib/contact-schemas";
import { Brand } from "@/components/AppHeader";
import { PolicyCheckbox } from "@/components/PolicyCheckbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/inbjudan")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acceptera personlig inbjudan — REKO UF" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: InvitationPage,
});
type Details = { school_name: string; member_type: string; has_password: boolean };
function InvitationPage() {
  const navigate = useNavigate();
  const inspect = useServerFn(inspectSchoolInvitation);
  const accept = useServerFn(acceptSchoolInvitation);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const incoming = invitationToken(params.get("token"));
    // Remove the invitation secret before any navigation; fragments aren't sent in HTTP requests.
    if (params.has("token")) window.history.replaceState(null, "", window.location.pathname);
    let pending: string | null = incoming;
    try {
      if (incoming)
        localStorage.setItem(
          INVITATION_STORAGE_KEY,
          JSON.stringify({ token: incoming, at: Date.now() }),
        );
      else {
        const saved = JSON.parse(localStorage.getItem(INVITATION_STORAGE_KEY) ?? "null");
        if (saved && Date.now() - saved.at < 48 * 60 * 60 * 1000)
          pending = invitationToken(saved.token);
        else localStorage.removeItem(INVITATION_STORAGE_KEY);
      }
    } catch {
      /* Storage may be blocked; the current-tab invitation can still be accepted. */
    }
    setToken(pending);
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user);
        setReady(true);
      }
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!token || !user) return;
    let active = true;
    setDetails(null);
    setError(null);
    void inspect({ data: { token } })
      .then((value) => {
        if (active) setDetails(value);
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "Kunde inte kontrollera inbjudan");
      });
    return () => {
      active = false;
    };
  }, [token, user?.id, inspect]);
  async function requestVerification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!z.string().email().max(255).safeParse(email).success) {
      setError("Fyll i giltig e-postadress");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: new URL("/inbjudan", window.location.origin).href,
          shouldCreateUser: true,
        },
      });
      if (authError) throw authError;
      setSent(true);
    } catch {
      setError("Kunde inte skicka verifieringslänken. Försök igen senare.");
    } finally {
      setBusy(false);
    }
  }
  async function finish(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !details) return;
    const fd = new FormData(e.currentTarget);
    const contact = z
      .object({ fullName: nameField, phone: phoneField })
      .safeParse({ fullName: String(fd.get("name") ?? ""), phone: String(fd.get("phone") ?? "") });
    if (!contact.success) {
      setError(contact.error.issues[0]?.message ?? "Kontrollera uppgifterna");
      return;
    }
    const password = String(fd.get("password") ?? "");
    if (!details.has_password && !z.string().min(8).max(72).safeParse(password).success) {
      setError("Välj ett lösenord med minst 8 tecken");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!details.has_password) {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) throw new Error("Kunde inte spara lösenordet. Försök igen.");
      }
      await accept({ data: { token, ...contact.data } });
      try {
        localStorage.removeItem(INVITATION_STORAGE_KEY);
      } catch {
        /* no storage */
      }
      window.location.replace("/skola");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte acceptera inbjudan");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <Brand />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Personlig inbjudan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!ready ? (
            <p>Laddar…</p>
          ) : !token ? (
            <>
              <p>
                Öppna den personliga länken i inbjudningsmejlet. Länken kan användas en gång och
                gäller i 48 timmar.
              </p>
              <Link to="/auth" className="underline">
                Till inloggningen
              </Link>
            </>
          ) : !user ? (
            <>
              <p>
                Verifiera samma e-postadress som fick inbjudan. Skolåtkomst aktiveras först när du
                har bekräftat adressen.
              </p>
              <form className="grid gap-3" onSubmit={requestVerification}>
                <Label htmlFor="invite-email">Din e-postadress</Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={255}
                />
                <Button disabled={busy}>{busy ? "Skickar…" : "Skicka verifieringslänk"}</Button>
              </form>
              {sent && (
                <p role="status">
                  Kontrollera din e-post. Öppna verifieringslänken i samma webbläsare. Om den
                  personliga länken saknas efteråt, öppna originalinbjudan igen.
                </p>
              )}
              <Link to="/auth" search={{ next: "invite" }} className="text-sm underline">
                Har du redan konto? Logga in med lösenord
              </Link>
            </>
          ) : details ? (
            <>
              <p>
                Du är inloggad som <strong>{user.email}</strong>. Gå med som{" "}
                {details.member_type === "teacher" ? "lärare" : "skolansvarig"} för{" "}
                <strong>{details.school_name}</strong>.
              </p>
              <form className="grid gap-3" onSubmit={finish}>
                <Label htmlFor="invite-name">Namn</Label>
                <Input
                  id="invite-name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={120}
                  defaultValue={user.user_metadata?.["full_name"] ?? ""}
                />
                <Label htmlFor="invite-phone">Telefon</Label>
                <Input
                  id="invite-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  minLength={5}
                  maxLength={40}
                  pattern="[+0-9 ()-]+"
                />
                {!details.has_password && (
                  <>
                    <Label htmlFor="invite-password">Välj ditt lösenord</Label>
                    <Input
                      id="invite-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      required
                    />
                  </>
                )}
                <PolicyCheckbox />
                <Button disabled={busy}>{busy ? "Sparar…" : "Acceptera inbjudan"}</Button>
              </form>
            </>
          ) : !error ? (
            <p>Kontrollerar inbjudan…</p>
          ) : null}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {user && (
            <Button
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                setDetails(null);
                setError(null);
              }}
            >
              Byt konto
            </Button>
          )}
          <a href="mailto:hej@rekoweb.com" className="text-sm underline">
            Kontakta REKO om du behöver en ny länk
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
