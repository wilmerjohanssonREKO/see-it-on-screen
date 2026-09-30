import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Brand } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logga in eller bli vikarie — REKO UF" },
      {
        name: "description",
        content:
          "Skapa ett vikariekonto hos REKO UF eller logga in för att se och tacka ja till vikariebehov på gymnasieskolor.",
      },
      { property: "og:title", content: "Logga in eller bli vikarie — REKO UF" },
      { property: "og:description", content: "Konto för vikarier och REKO UF-teamet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Ogiltig e-postadress").max(255),
  password: z.string().min(6, "Lösenordet måste vara minst 6 tecken").max(72),
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/uppdrag" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/uppdrag" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fullName = String(fd.get("full_name") ?? "").trim();
    const parsed = schema.safeParse({
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Kontrollera fälten");
      return;
    }
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        toast.success("Konto skapat! Kolla din e-post och bekräfta adressen.");
        return;
      }
      toast.success("Välkommen! Fyll i din profil.");
      navigate({ to: "/profil" });
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      setBusy(false);
      if (error) {
        toast.error("Fel e-post eller lösenord");
        return;
      }
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Kunde inte logga in med Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/uppdrag" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <Brand />
      <Card className="w-full max-w-md shadow-lift">
        <CardHeader>
          <CardTitle className="text-2xl">
            {mode === "signin" ? "Logga in" : "Skapa vikariekonto"}
          </CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "För vikarier och REKO UF-teamet."
              : "Registrera dig som vikarie. Din profil granskas av oss innan du kan matchas."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button type="button" variant="outline" onClick={handleGoogle}>
            Fortsätt med Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            eller
            <span className="h-px flex-1 bg-border" />
          </div>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="grid gap-2">
                <Label htmlFor="full_name">Namn</Label>
                <Input id="full_name" name="full_name" maxLength={120} required />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">E-post</Label>
              <Input id="email" name="email" type="email" maxLength={255} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input id="password" name="password" type="password" maxLength={72} required />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Vänta…" : mode === "signin" ? "Logga in" : "Skapa konto"}
            </Button>
          </form>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin"
              ? "Har du inget konto? Bli vikarie"
              : "Har du redan ett konto? Logga in"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
