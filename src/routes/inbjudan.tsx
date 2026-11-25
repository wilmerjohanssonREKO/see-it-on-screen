import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { acceptSchoolInvitation, inspectSchoolInvitation } from "@/lib/teacher.functions";
import { INVITATION_STORAGE_KEY, invitationToken } from "@/lib/auth-navigation";
import { accountNameSchema, phoneField } from "@/lib/contact-schemas";
import { passwordValidationMessage } from "@/lib/password";
import { PasswordChecklist } from "@/components/PasswordChecklist";
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
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
      await navigate({ to: "/bekrafta-epost", search: { email, mode: "invite" } });
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
    const parsedContact = accountNameSchema
      .and(z.object({ phone: phoneField }))
      .safeParse({
        firstName: String(fd.get("first_name") ?? ""),
        lastName: String(fd.get("last_name") ?? ""),
        phone: String(fd.get("phone") ?? ""),
      });
    if (!parsedContact.success) {
      setError(parsedContact.error.issues[0]?.message ?? "Kontrollera uppgifterna");
      return;
    }
    const contact = {
      fullName: `${parsedContact.data.firstName} ${parsedContact.data.lastName}`,
      phone: parsedContact.data.phone,
    };
    const password = String(fd.get("password") ?? "");
    const passwordMessage = passwordValidationMessage(password);
    if (!details.has_password && passwordMessage) {
      setError(passwordMessage);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!details.has_password) {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) throw new Error("Kunde inte spara lösenordet. Försök igen.");
      }
      await accept({ data: { token, ...contact } });
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="invite-first-name">Förnamn</Label>
                    <Input
                      id="invite-first-name"
                      name="first_name"
                      autoComplete="given-name"
                      required
                      maxLength={120}
                      defaultValue={
                        typeof user.user_metadata?.["full_name"] === "string"
                          ? user.user_metadata["full_name"].trim().split(/\s+/)[0]
                          : ""
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="invite-last-name">Efternamn</Label>
                    <Input
                      id="invite-last-name"
                      name="last_name"
                      autoComplete="family-name"
                      required
                      maxLength={120}
                      defaultValue={
                        typeof user.user_metadata?.["full_name"] === "string"
                          ? user.user_metadata["full_name"].trim().split(/\s+/).slice(1).join(" ")
                          : ""
                      }
                    />
                  </div>
                </div>
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
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <PasswordChecklist password={password} />
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
