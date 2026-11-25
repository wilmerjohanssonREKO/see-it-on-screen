import { PolicyCheckbox } from "@/components/PolicyCheckbox";
import { createFileRoute, Link, useNavigate, type SearchSchemaInput } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { accountNameSchema } from "@/lib/contact-schemas";
import { passwordValidationMessage, strongPasswordSchema } from "@/lib/password";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { postAuthDestination } from "@/lib/post-auth";
import { authDestination } from "@/lib/auth-navigation";
import { Brand } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search: SearchSchemaInput & { mode?: unknown; next?: unknown },
  ): { mode?: "signup" | undefined; next?: "invite" | undefined } => ({
    mode: search.mode === "signup" ? "signup" : undefined,
    next: search.next === "invite" ? "invite" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Logga in eller bli vikarie — REKO UF" },
      {
        name: "description",
        content: "Gemensam inloggning för vikarier, skolor, lärare och REKO UF-teamet.",
      },
    ],
  }),
  component: AuthPage,
});
const schema = z.object({
  email: z.string().trim().email("Ogiltig e-postadress").max(255),
  password: z.string().min(1).max(72),
});
function AuthPage() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(search.mode ?? "signin");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    setMode(search.mode ?? "signin");
    setPassword("");
  }, [search.mode]);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") {
        void navigate({ to: "/aterstall-losenord" });
        return;
      }
      setSession(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);
  useEffect(() => {
    if (!session || submitting.current) return;
    let active = true;
    setRouteError(null);
    void (async () => {
      try {
        const destination = authDestination(search.next) ?? (await postAuthDestination());
        if (active) await navigate({ to: destination, replace: true });
      } catch (error) {
        if (active)
          setRouteError(error instanceof Error ? error.message : "Kunde inte öppna kontot");
      }
    })();
    return () => {
      active = false;
    };
  }, [session, search.next, navigate]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    if (mode === "forgot") {
      if (!z.string().email().max(255).safeParse(email).success) {
        toast.error("Fyll i giltig e-postadress");
        return;
      }
      setBusy(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: new URL("/aterstall-losenord", window.location.origin).href,
        });
        if (error) throw error;
        toast.success("Om adressen har ett konto får du ett mejl med en återställningslänk.");
      } catch {
        toast.error("Kunde inte skicka återställningsmejlet. Försök igen senare.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const passwordValue = String(fd.get("password") ?? "");
    if (mode === "signup") {
      const passwordMessage = passwordValidationMessage(passwordValue);
      if (passwordMessage) {
        toast.error(passwordMessage);
        return;
      }
    }
    // Existing accounts keep their old passwords; new passwords must meet the visible checklist.
    const parsed = (
      mode === "signup" ? schema.extend({ password: strongPasswordSchema }) : schema
    ).safeParse({ email, password: passwordValue });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Kontrollera uppgifterna");
      return;
    }
    const names =
      mode === "signup"
        ? accountNameSchema.safeParse({
            firstName: String(fd.get("first_name") ?? ""),
            lastName: String(fd.get("last_name") ?? ""),
          })
        : null;
    if (mode === "signup" && !names?.success) {
      toast.error(names?.error.issues[0]?.message ?? "Fyll i förnamn och efternamn");
      return;
    }
    const fullName = names?.success ? `${names.data.firstName} ${names.data.lastName}` : "";
    setBusy(true);
    submitting.current = true;
    try {
      if (mode === "signup") {
        const callback = new URL("/auth", window.location.origin);
        if (search.next) callback.searchParams.set("next", search.next);
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: callback.href, data: { full_name: fullName } },
        });
        if (error) throw error;
        if (!data.session) {
          await navigate({
            to: "/bekrafta-epost",
            search: {
              email: parsed.data.email,
              mode: "signup",
              ...(search.next ? { next: search.next } : {}),
            },
          });
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw new Error("Fel e-post eller lösenord");
      }
      const destination = authDestination(search.next) ?? (await postAuthDestination());
      await navigate({ to: destination, replace: true });
    } catch (error) {
      const errorCode =
        error && typeof error === "object" && "code" in error ? String(error.code) : "";
      toast.error(
        errorCode === "weak_password"
          ? "Lösenordet kunde inte godkännas. Välj ett annat lösenord."
          : error instanceof Error
            ? error.message
            : "Kunde inte logga in",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    try {
      const callback = new URL("/auth", window.location.origin);
      if (search.next) callback.searchParams.set("next", search.next);
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: callback.href });
      if (result.error) throw result.error;
      if (!result.redirected) {
        await navigate({
          to: authDestination(search.next) ?? (await postAuthDestination()),
          replace: true,
        });
      }
    } catch {
      toast.error("Kunde inte logga in med Google");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <Brand />
      <Card className="w-full max-w-md shadow-lift">
        <CardHeader>
          <CardTitle className="text-2xl">
            {mode === "signin"
              ? "Logga in"
              : mode === "signup"
                ? "Skapa vikariekonto"
                : "Återställ lösenord"}
          </CardTitle>
          <CardDescription>
            {mode === "forgot"
              ? "Ange din e-postadress så skickar vi en återställningslänk."
              : search.next === "invite"
                ? "Logga in med e-postadressen som fick din personliga inbjudan."
                : mode === "signin"
                  ? "För vikarier, skolor, lärare och REKO UF-teamet."
                  : "Din profil granskas innan du kan söka uppdrag."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 [&_button]:min-h-11 [&_input:not([type=checkbox])]:min-h-11">
          {routeError && (
            <p role="alert" className="text-sm text-destructive">
              {routeError}
            </p>
          )}
          {mode !== "forgot" && (
            <>
              <Button type="button" variant="outline" onClick={google} disabled={busy}>
                Fortsätt med Google
              </Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                eller
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          <form method="post" action="/auth" className="grid gap-4" onSubmit={submit}>
            {mode === "signup" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="first_name">Förnamn</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    maxLength={120}
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last_name">Efternamn</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    maxLength={120}
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={255}
                required
              />
            </div>
            {mode !== "forgot" && (
              <div className="grid gap-2">
                <Label htmlFor="password">Lösenord</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={mode === "signup" ? 8 : undefined}
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
            )}
            {mode === "signup" && <PasswordChecklist password={password} />}
            {mode === "signup" && (
              <>
                <label className="flex items-start gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    name="adult"
                    required
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span>Jag är 18 år eller äldre</span>
                </label>
                <PolicyCheckbox />
              </>
            )}
            <Button type="submit" disabled={!hydrated || busy}>
              {busy
                ? "Vänta…"
                : mode === "signin"
                  ? "Logga in"
                  : mode === "signup"
                    ? "Skapa konto"
                    : "Skicka återställningslänk"}
            </Button>
          </form>
          {mode === "signin" && (
            <Button type="button" variant="ghost" onClick={() => setMode("forgot")}>
              Glömt lösenord?
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Har du inget konto? Bli vikarie" : "Till inloggning"}
          </Button>
          <Link
            to="/larare/registrera"
            className="flex min-h-11 items-center justify-center text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Lärare eller skolansvarig? Använd din personliga inbjudan.
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
