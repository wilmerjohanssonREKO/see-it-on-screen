import { PolicyCheckbox } from "@/components/PolicyCheckbox";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { listSchoolsForSignup, registerTeacher } from "@/lib/teacher.functions";
import { teacherRegistrationSchema } from "@/lib/contact-schemas";
import { Brand } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/larare/registrera")({
  head: () => ({
    meta: [
      { title: "Registrera lärarkonto — REKO UF" },
      {
        name: "description",
        content: "Lärare skapar konto med sin skolas skolkod och publicerar vikariebehov direkt.",
      },
      { property: "og:title", content: "Registrera lärarkonto — REKO UF" },
      { property: "og:description", content: "Gå med i din skola på REKO UF med skolkoden." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeacherSignup,
});

function TeacherSignup() {
  const navigate = useNavigate();
  const register = useServerFn(registerTeacher);
  const fetchSchools = useServerFn(listSchoolsForSignup);
  const { data: schools } = useQuery({
    queryKey: ["signup-schools"],
    queryFn: () => fetchSchools(),
  });
  const [schoolId, setSchoolId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!schoolId) {
      setError("Välj skola");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const parsed = teacherRegistrationSchema.safeParse({
      fullName: String(fd.get("full_name") ?? ""),
      email,
      password,
      phone: String(fd.get("phone") ?? ""),
      schoolId,
      code: String(fd.get("code") ?? ""),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Kontrollera uppgifterna");
      return;
    }
    setBusy(true);
    try {
      const res = await register({ data: parsed.data });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
      if (sErr) {
        toast.success("Konto skapat! Logga in.");
        navigate({ to: "/auth" });
        return;
      }
      toast.success("Välkommen! Du kan nu publicera vikariebehov.");
      navigate({ to: "/skola" });
    } catch {
      setError("Kontrollera att alla fält är rätt ifyllda (lösenord minst 8 tecken).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <Brand />
      <Card className="w-full max-w-md shadow-lift">
        <CardHeader>
          <CardTitle className="text-2xl">Skapa lärarkonto</CardTitle>
          <CardDescription>Du behöver skolkoden som din skola fått från REKO UF.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="full_name">Namn</Label>
              <Input id="full_name" name="full_name" required maxLength={120} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-post</Label>
              <Input id="email" name="email" type="email" required maxLength={255} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                required
                minLength={5}
                maxLength={40}
                pattern="[+0-9 ()-]+"
              />
            </div>
            <div className="grid gap-2">
              <Label>Skola</Label>
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj skola" />
                </SelectTrigger>
                <SelectContent>
                  {schools?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">Skolkod</Label>
              <Input id="code" name="code" required maxLength={40} autoComplete="off" />
            </div>
            <PolicyCheckbox />
            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Skapar…" : "Skapa lärarkonto"}
            </Button>
          </form>
          <Link
            to="/auth"
            className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Har du redan ett konto? Logga in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
