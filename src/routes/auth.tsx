import { PolicyCheckbox } from "@/components/PolicyCheckbox";
import { createFileRoute, Link, useNavigate, type SearchSchemaInput } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { nameField } from "@/lib/contact-schemas";
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
  password: z.string().min(8, "Lösenordet måste vara minst 8 tecken").max(72),
});
function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(search.mode ?? "signin");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    setMode(search.mode ?? "signin");
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
    // Existing accounts retain their old passwords; new passwords require at least 8 characters.
    const parsed = (
      mode === "signup" ? schema : schema.extend({ password: z.string().min(1).max(72) })
    ).safeParse({ email, password: String(fd.get("password") ?? "") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Kontrollera uppgifterna");
      return;
    }
    const fullName = String(fd.get("full_name") ?? "").trim();
    if (mode === "signup" && !nameField.safeParse(fullName).success) {
      toast.error("Fyll i namn");
      return;
    }
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
          toast.success("Konto skapat! Bekräfta din e-postadress innan du loggar in.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw new Error("Fel e-post eller lösenord");
      }
      const destination = authDestination(search.next) ?? (await postAuthDestination());
      await navigate({ to: destination, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte logga in");
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
          <form className="grid gap-4" onSubmit={submit}>
            {mode === "signup" && (
              <div className="grid gap-2">
                <Label htmlFor="full_name">Namn</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  maxLength={120}
                  autoComplete="name"
                  required
                />
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
                  required
                />
              </div>
            )}
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
            <Button type="submit" disabled={busy}>
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
