import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABELS, SUBJECTS, formatTime } from "@/lib/subjects";

export const Route = createFileRoute("/_authenticated/skola")({
  beforeLoad: async () => {
    const { data } = await supabase.rpc("my_school_id");
    if (!data) throw redirect({ to: "/uppdrag" });
    return { schoolId: data as string };
  },
  head: () => ({
    meta: [
      { title: "Skolsida — REKO UF" },
      { name: "description", content: "Publicera vikariebehov och följ era uppdrag hos REKO UF." },
      { property: "og:title", content: "Skolsida — REKO UF" },
      { property: "og:description", content: "Publicera vikariebehov direkt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchoolPage,
});

function SchoolPage() {
  const { schoolId } = Route.useRouteContext();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: school } = useQuery({
    queryKey: ["my-school", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
      return data;
    },
  });

  const { data: list } = useQuery({
    queryKey: ["school-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("school_assignments");
      if (error) throw error;
      return data;
    },
  });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!subject) return toast.error("Välj ämne");
    setBusy(true);
    const { data: a, error } = await supabase
      .from("assignments")
      .insert({
        school_id: schoolId,
        subject,
        assignment_date: String(fd.get("date")),
        start_time: String(fd.get("start")),
        end_time: String(fd.get("end")),
        compensation: String(fd.get("compensation") ?? "").trim().slice(0, 120) || null,
        description: String(fd.get("description") ?? "").trim().slice(0, 1000) || null,
      })
      .select("id")
      .single();
    if (error || !a) {
      setBusy(false);
      return toast.error("Kunde inte spara behovet");
    }
    const { data: count, error: pErr } = await supabase.rpc("publish_assignment", {
      p_assignment_id: a.id,
    });
    setBusy(false);
    if (pErr) return toast.error("Sparat men kunde inte publiceras");
    toast.success(`Publicerat! ${count ?? 0} vikarier har fått notis.`);
    form.reset();
    setSubject("");
    qc.invalidateQueries({ queryKey: ["school-assignments"] });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-8">
        <div>
          <h1 className="font-display text-3xl font-bold">{school?.name ?? "Er skola"}</h1>
          <p className="text-muted-foreground">Lägg upp ett vikariebehov — matchade vikarier får besked direkt.</p>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Nytt vikariebehov</CardTitle>
            <CardDescription>Första godkända vikarien som tackar ja får uppdraget.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
              <div className="grid gap-2">
                <Label>Ämne</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger><SelectValue placeholder="Välj ämne" /></SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Datum</Label>
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="start">Från</Label>
                <Input id="start" name="start" type="time" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end">Till</Label>
                <Input id="end" name="end" type="time" required />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="compensation">Ersättning (valfritt)</Label>
                <Input id="compensation" name="compensation" maxLength={120} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="description">Beskrivning (valfritt)</Label>
                <Textarea id="description" name="description" maxLength={1000} placeholder="Klass, lokal, vad som ska göras…" />
              </div>
              <Button type="submit" className="sm:col-span-2" disabled={busy}>
                <Send className="h-4 w-4" /> {busy ? "Publicerar…" : "Publicera vikariebehov"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <section className="grid gap-3">
          <h2 className="font-display text-xl font-semibold">Era vikariebehov</h2>
          {list?.length === 0 && <p className="text-muted-foreground">Inga behov än.</p>}
          {list?.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-6">
                <div>
                  <p className="font-semibold">{a.subject} · {a.assignment_date}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(a.start_time)}–{formatTime(a.end_time)}
                    {a.substitute_name ? ` · Vikarie: ${a.substitute_name}${a.substitute_phone ? ` (${a.substitute_phone})` : ""}` : ""}
                  </p>
                </div>
                <Badge variant={a.status === "open" ? "secondary" : "default"}>
                  {STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] ?? a.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
