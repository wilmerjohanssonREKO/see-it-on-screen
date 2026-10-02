import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, Send, Star, Trash2, Beaker, Copy, Download } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { AppHeader } from "@/components/AppHeader";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BACKGROUND_LABELS, STATUS_LABELS, SUBJECTS, formatTime } from "@/lib/subjects";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Adminpanel — REKO UF" },
      {
        name: "description",
        content:
          "Lägg upp vikariebehov, godkänn vikarier, hantera skolförfrågningar och sätt betyg i REKO UF:s adminpanel.",
      },
      { property: "og:title", content: "Adminpanel — REKO UF" },
      { property: "og:description", content: "Intern översikt för REKO UF-teamet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { session } = useAuth();
  const { data: isAdmin, isLoading } = useIsAdmin(session?.user.id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <p className="p-8 text-muted-foreground">Laddar…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Endast för REKO UF-teamet</h1>
          <p className="mt-2 text-muted-foreground">Ditt konto har inte adminbehörighet.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold">Adminpanel</h1>
        <p className="mt-1 text-muted-foreground">Hantera behov, vikarier, skolor och betyg.</p>
        <Tabs defaultValue="behov" className="mt-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="behov">Vikariebehov</TabsTrigger>
            <TabsTrigger value="forfragningar">Skolförfrågningar</TabsTrigger>
            <TabsTrigger value="vikarier">Vikarier</TabsTrigger>
            <TabsTrigger value="skolor">Skolor</TabsTrigger>
            <TabsTrigger value="testdata">Testdata</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>
          <TabsContent value="behov">
            <AssignmentsTab />
          </TabsContent>
          <TabsContent value="forfragningar">
            <RequestsTab />
          </TabsContent>
          <TabsContent value="vikarier">
            <SubstitutesTab />
          </TabsContent>
          <TabsContent value="skolor">
            <SchoolsTab />
          </TabsContent>
          <TabsContent value="testdata">
            <TestDataTab />
          </TabsContent>
          <TabsContent value="feedback">
            <FeedbackTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- Vikariebehov ---------------- */

function AssignmentsTab() {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select(
          "*, schools(name, contact_person, email, phone), profiles:assigned_substitute_id(full_name, email, phone)",
        )
        .order("assignment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: notifCounts } = useQuery({
    queryKey: ["notif-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("assignment_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const n of data ?? []) map[n.assignment_id] = (map[n.assignment_id] ?? 0) + 1;
      return map;
    },
  });

  async function createAssignment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId || !subject) {
      toast.error("Välj skola och ämne");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const { data, error } = await supabase
      .from("assignments")
      .insert({
        school_id: schoolId,
        subject,
        assignment_date: String(fd.get("assignment_date")),
        start_time: String(fd.get("start_time")),
        end_time: String(fd.get("end_time")),
        description: String(fd.get("description") ?? "").slice(0, 1000) || null,
        compensation: String(fd.get("compensation") ?? "").slice(0, 120) || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      setSaving(false);
      toast.error("Kunde inte skapa behovet");
      return;
    }
    const { data: count, error: pubError } = await supabase.rpc("publish_assignment", {
      p_assignment_id: data.id,
    });
    setSaving(false);
    if (pubError) toast.error("Behovet skapades men kunde inte publiceras");
    else toast.success(`Publicerat — ${count ?? 0} matchande vikarier notifierade`);
    (e.target as HTMLFormElement).reset();
    setSubject("");
    qc.invalidateQueries({ queryKey: ["assignments"] });
    qc.invalidateQueries({ queryKey: ["notif-counts"] });
  }

  async function setStatus(id: string, status: "open" | "filled" | "expired") {
    const { error } = await supabase.from("assignments").update({ status }).eq("id", id);
    if (error) toast.error("Kunde inte uppdatera");
    else qc.invalidateQueries({ queryKey: ["assignments"] });
  }

  async function deleteAssignment(id: string) {
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) toast.error("Kunde inte ta bort behovet");
    else {
      toast.success("Behov borttaget");
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["notif-counts"] });
    }
  }

  return (
    <div className="mt-4 grid gap-6">
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Nytt vikariebehov
          </CardTitle>
          <CardDescription>
            När du publicerar notifieras alla godkända vikarier med rätt ämne.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(schools?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Lägg till en skola under fliken Skolor först.
            </p>
          ) : (
            <form className="grid gap-4" onSubmit={createAssignment}>
              <div className="grid gap-4 sm:grid-cols-2">
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
                  <Label>Ämne</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj ämne" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="assignment_date">Datum</Label>
                  <Input id="assignment_date" name="assignment_date" type="date" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="compensation">Ersättning</Label>
                  <Input id="compensation" name="compensation" placeholder="T.ex. 180 kr/tim" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="start_time">Från</Label>
                  <Input id="start_time" name="start_time" type="time" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_time">Till</Label>
                  <Input id="end_time" name="end_time" type="time" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Beskrivning</Label>
                <Textarea id="description" name="description" rows={3} maxLength={1000} />
              </div>
              <Button type="submit" disabled={saving}>
                <Send className="h-4 w-4" />
                {saving ? "Publicerar…" : "Publicera och notifiera vikarier"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {assignments?.map((a) => {
          const sub = a.profiles as { full_name: string; email: string; phone: string | null } | null;
          return (
            <Card key={a.id}>
              <CardContent className="grid gap-2 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {a.subject} · {a.schools?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {a.assignment_date} {formatTime(a.start_time)}–{formatTime(a.end_time)} ·{" "}
                      {notifCounts?.[a.id] ?? 0} notifierade
                    </p>
                  </div>
                  <Badge variant={a.status === "open" ? "default" : "secondary"}>
                    {STATUS_LABELS[a.status]}
                  </Badge>
                </div>
                {sub ? (
                  <div className="rounded-lg bg-secondary p-3 text-sm">
                    <p className="font-medium">Tackade ja: {sub.full_name || sub.email}</p>
                    <p className="text-muted-foreground">
                      {sub.email} {sub.phone ? `· ${sub.phone}` : ""}
                    </p>
                    {a.schools?.contact_person && (
                      <p className="mt-1 text-muted-foreground">
                        Meddela {a.schools.contact_person}
                        {a.schools.email ? ` (${a.schools.email})` : ""}
                        {a.schools.phone ? ` · ${a.schools.phone}` : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Ingen har tackat ja ännu.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {a.status !== "expired" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "expired")}>
                      Markera utgånget
                    </Button>
                  )}
                  {a.status !== "open" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(a.id, "open")}>
                      Öppna igen
                    </Button>
                  )}
                  {a.assigned_substitute_id && (
                    <RatingForm
                      substituteId={a.assigned_substitute_id}
                      assignmentId={a.id}
                    />
                  )}
                  <Button size="sm" variant="destructive" onClick={() => deleteAssignment(a.id)}>
                    <Trash2 className="h-4 w-4" /> Radera
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function RatingForm({ substituteId, assignmentId }: { substituteId: string; assignmentId: string }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState("5");
  const qc = useQueryClient();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("ratings").insert({
      substitute_id: substituteId,
      assignment_id: assignmentId,
      score: Number(score),
      comment: String(fd.get("comment") ?? "").slice(0, 500) || null,
    });
    if (error) toast.error("Kunde inte spara betyget");
    else {
      toast.success("Betyg sparat");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["substitutes"] });
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="accent" onClick={() => setOpen(true)}>
        <Star className="h-4 w-4" /> Sätt betyg
      </Button>
    );
  }

  return (
    <form className="flex w-full flex-wrap items-end gap-2" onSubmit={save}>
      <div className="grid gap-1">
        <Label className="text-xs">Betyg</Label>
        <Select value={score} onValueChange={setScore}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid flex-1 gap-1">
        <Label className="text-xs">Kommentar</Label>
        <Input name="comment" maxLength={500} />
      </div>
      <Button size="sm" type="submit">
        Spara
      </Button>
      <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
        Avbryt
      </Button>
    </form>
  );
}

/* ---------------- Skolförfrågningar ---------------- */

function RequestsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["school-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function toggle(id: string, handled: boolean) {
    const { error } = await supabase.from("school_requests").update({ handled }).eq("id", id);
    if (error) toast.error("Kunde inte uppdatera");
    else qc.invalidateQueries({ queryKey: ["school-requests"] });
  }

  async function deleteRequest(id: string) {
    const { error } = await supabase.from("school_requests").delete().eq("id", id);
    if (error) toast.error("Kunde inte ta bort");
    else {
      toast.success("Förfrågan borttagen");
      qc.invalidateQueries({ queryKey: ["school-requests"] });
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      {(data?.length ?? 0) === 0 && (
        <p className="text-muted-foreground">Inga förfrågningar än.</p>
      )}
      {data?.map((r) => (
        <Card key={r.id}>
          <CardContent className="grid gap-2 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{r.school_name}</p>
              <Badge variant={r.handled ? "secondary" : "default"}>
                {r.handled ? "Behandlad" : "Ny"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {r.contact_person} · {r.contact_email ?? ""} {r.contact_phone ?? ""}
            </p>
            <p className="text-sm">{r.description}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => toggle(r.id, !r.handled)}>
                <Check className="h-4 w-4" />
                {r.handled ? "Markera som ny" : "Markera som behandlad"}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => deleteRequest(r.id)}>
                <Trash2 className="h-4 w-4" /> Radera
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Vikarier ---------------- */

function SubstitutesTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["substitutes"],
    queryFn: async () => {
      const [profiles, ratings, assignments] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("ratings").select("substitute_id, score"),
        supabase.from("assignments").select("assigned_substitute_id"),
      ]);
      if (profiles.error) throw profiles.error;
      return (profiles.data ?? []).map((p) => {
        const scores = (ratings.data ?? [])
          .filter((r) => r.substitute_id === p.id)
          .map((r) => r.score);
        return {
          ...p,
          completed: (assignments.data ?? []).filter((a) => a.assigned_substitute_id === p.id)
            .length,
          average: scores.length
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
            : null,
        };
      });
    },
  });

  async function update(id: string, patch: TablesUpdate<"profiles">) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) toast.error("Kunde inte uppdatera");
    else {
      toast.success("Uppdaterat");
      qc.invalidateQueries({ queryKey: ["substitutes"] });
    }
  }

  async function deleteSubstitute(id: string) {
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) toast.error("Kunde inte ta bort vikarien");
    else {
      toast.success("Vikarie borttagen");
      qc.invalidateQueries({ queryKey: ["substitutes"] });
    }
  }

  async function openFile(path: string) {
    const { data, error } = await supabase.storage
      .from("background-checks")
      .createSignedUrl(path, 60);
    if (error || !data) toast.error("Kunde inte öppna filen");
    else window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div className="mt-4 grid gap-3">
      {data?.map((p) => (
        <Card key={p.id}>
          <CardContent className="grid gap-2 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{p.full_name || p.email}</p>
                <p className="text-sm text-muted-foreground">
                  {p.email} {p.phone ? `· ${p.phone}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={p.approved ? "default" : "secondary"}>
                  {p.approved ? "Godkänd" : "Ej godkänd"}
                </Badge>
                <Badge variant="outline">{BACKGROUND_LABELS[p.background_status]}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {p.school_name ?? "—"} {p.graduation_year ? `· examen ${p.graduation_year}` : ""} ·{" "}
              {p.completed} uppdrag · snittbetyg {p.average ?? "–"}
            </p>
            <p className="text-sm">Ämnen: {p.subjects.join(", ") || "inga valda"}</p>
            {p.availability && (
              <p className="text-sm text-muted-foreground">Tillgänglighet: {p.availability}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => update(p.id, { approved: !p.approved })}>
                {p.approved ? "Ta bort godkännande" : "Godkänn vikarie"}
              </Button>
              <Select
                value={p.background_status}
                onValueChange={(v) => update(p.id, { background_status: v })}
              >
                <SelectTrigger className="h-8 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Väntar granskning</SelectItem>
                  <SelectItem value="approved">Godkänd</SelectItem>
                  <SelectItem value="needs_renewal">Behöver förnyas</SelectItem>
                </SelectContent>
              </Select>
              {p.background_file_path && (
                <Button size="sm" variant="ghost" onClick={() => openFile(p.background_file_path!)}>
                  Visa utdrag
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => deleteSubstitute(p.id)}>
                <Trash2 className="h-4 w-4" /> Radera
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Skolor ---------------- */

function SchoolsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("schools").insert({
      name: String(fd.get("name") ?? "").trim().slice(0, 120),
      contact_person: String(fd.get("contact_person") ?? "").trim().slice(0, 120) || null,
      email: String(fd.get("email") ?? "").trim().slice(0, 255) || null,
      phone: String(fd.get("phone") ?? "").trim().slice(0, 40) || null,
    });
    if (error) toast.error("Kunde inte lägga till skolan");
    else {
      toast.success("Skola tillagd");
      (e.target as HTMLFormElement).reset();
      qc.invalidateQueries({ queryKey: ["schools"] });
    }
  }

  async function deleteSchool(id: string) {
    const { error } = await supabase.from("schools").delete().eq("id", id);
    if (error) toast.error("Kunde inte ta bort skolan");
    else {
      toast.success("Skola borttagen");
      qc.invalidateQueries({ queryKey: ["schools"] });
    }
  }

  return (
    <div className="mt-4 grid gap-6">
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Lägg till skola</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={add}>
            <div className="grid gap-2">
              <Label htmlFor="name">Namn</Label>
              <Input id="name" name="name" maxLength={120} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_person">Kontaktperson</Label>
              <Input id="contact_person" name="contact_person" maxLength={120} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-post</Label>
              <Input id="email" name="email" type="email" maxLength={255} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" name="phone" maxLength={40} />
            </div>
            <Button type="submit" className="sm:col-span-2">
              Spara skola
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {data?.map((s) => (
          <Card key={s.id}>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.contact_person ?? "—"} {s.email ? `· ${s.email}` : ""}{" "}
                    {s.phone ? `· ${s.phone}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="destructive" onClick={() => deleteSchool(s.id)}>
                  <Trash2 className="h-4 w-4" /> Radera
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Testdata & Utveckling ---------------- */

function TestDataTab() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [createdEmails, setCreatedEmails] = useState<string[]>([]);
  const [showEmails, setShowEmails] = useState(false);

  const testSchools = [
    { name: "Donner Gymnasium", contact_person: "Anna Svensson", email: "anna@donner.se", phone: "070-123 45 67" },
    { name: "Praktiska Gymnasiet", contact_person: "Bo Lundberg", email: "bo@praktiska.se", phone: "070-234 56 78" },
    { name: "NTI Gymnasiet", contact_person: "Cecilia Bergman", email: "cecilia@nti.se", phone: "070-345 67 89" },
  ];

  const testSubstitutes = [
    { name: "Erik Andersson", email: "erik.andersson@test.se", phone: "070-111 22 33", school: "Donner Gymnasium", year: 2020, subjects: ["Matematik", "Fysik"] },
    { name: "Frida Bergström", email: "frida.bergstrom@test.se", phone: "070-222 33 44", school: "NTI Gymnasiet", year: 2021, subjects: ["Svenska", "Engelska"] },
    { name: "Gustav Carlsson", email: "gustav.carlsson@test.se", phone: "070-333 44 55", school: "Praktiska Gymnasiet", year: 2019, subjects: ["Matematik", "Kemi"] },
    { name: "Hanna Dahlberg", email: "hanna.dahlberg@test.se", phone: "070-444 55 66", school: "Donner Gymnasium", year: 2022, subjects: ["Historia", "Samhällskunskap"] },
    { name: "Igor Eklund", email: "igor.eklund@test.se", phone: "070-555 66 77", school: "NTI Gymnasiet", year: 2020, subjects: ["Biologi", "Kemi"] },
  ];

  const testSchoolRequests = [
    { school_name: "Sankt Erik Gymnasium", contact_person: "Lars Malmberg", contact_email: "lars@saintrik.se", contact_phone: "070-999 88 77", description: "Behöver 2 matematiklärare för ht24" },
    { school_name: "Södermalms Gymnasium", contact_person: "Maja Nilsson", contact_email: "maja@sodermalmsgym.se", contact_phone: "070-888 77 66", description: "Kemlärare under försöksperiod" },
  ];

  async function createTestSchools() {
    setLoading(true);
    try {
      for (const school of testSchools) {
        const { error } = await supabase.from("schools").insert(school);
        if (error) throw error;
      }
      toast.success(`${testSchools.length} testskolor tillagda`);
      qc.invalidateQueries({ queryKey: ["schools"] });
    } catch (err) {
      toast.error("Kunde inte skapa testskolor");
    }
    setLoading(false);
  }

  async function createTestSubstitutes() {
    setLoading(true);
    const emails: string[] = [];
    try {
      for (const sub of testSubstitutes) {
        // Skapa auth-konto
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: sub.email,
          password: "TestPassword123!", // Test-lösenord (ändra vid produktion)
        });
        if (authError) throw authError;
        if (authData.user) {
          emails.push(sub.email);
          // Uppdatera profil
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              full_name: sub.name,
              phone: sub.phone,
              school_name: sub.school,
              graduation_year: sub.year,
              subjects: sub.subjects,
              approved: true,
              background_status: "approved",
              availability: "Flexibel",
            })
            .eq("id", authData.user.id);
          if (profileError) throw profileError;
        }
      }
      setCreatedEmails(emails);
      toast.success(`${emails.length} testvikarier skapade`);
      qc.invalidateQueries({ queryKey: ["substitutes"] });
    } catch (err) {
      toast.error("Kunde inte skapa testvikarier");
    }
    setLoading(false);
  }

  async function createTestRequests() {
    setLoading(true);
    try {
      for (const req of testSchoolRequests) {
        const { error } = await supabase.from("school_requests").insert({
          ...req,
          handled: false,
        });
        if (error) throw error;
      }
      toast.success(`${testSchoolRequests.length} testförfrågningar tillagda`);
      qc.invalidateQueries({ queryKey: ["school-requests"] });
    } catch (err) {
      toast.error("Kunde inte skapa testförfrågningar");
    }
    setLoading(false);
  }

  async function clearAllData() {
    if (!confirm("Radera ALLT (skolor, vikarier, behov, förfrågningar, betyg, notifikationer)? Denna åtgärd kan inte ångras.")) {
      return;
    }
    setLoading(true);
    try {
      await supabase.from("notifications").delete().neq("id", "");
      await supabase.from("ratings").delete().neq("id", "");
      await supabase.from("assignments").delete().neq("id", "");
      await supabase.from("school_requests").delete().neq("id", "");
      await supabase.from("profiles").delete().neq("id", "");
      await supabase.from("schools").delete().neq("id", "");
      toast.success("All data raderad");
      qc.invalidateQueries();
      setCreatedEmails([]);
    } catch (err) {
      toast.error("Kunde inte radera data");
    }
    setLoading(false);
  }

  const downloadLoginCsv = () => {
    const csvContent = [
      ["Email", "Lösenord"],
      ...testSubstitutes.map(sub => [sub.email, "TestPassword123!"])
    ]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");
    
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent));
    element.setAttribute("download", "test-accounts.csv");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="mt-4 grid gap-6">
      <Card className="border-blue-200 bg-blue-50 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Beaker className="h-5 w-5" /> Testdata för utveckling
          </CardTitle>
          <CardDescription>Skapa testskolor, vikarier och förfrågningar för att utveckla och testa systemet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={createTestSchools} disabled={loading} variant="outline">
              <Plus className="h-4 w-4" /> Skapa testskolor ({testSchools.length})
            </Button>
            <Button onClick={createTestSubstitutes} disabled={loading} variant="outline">
              <Plus className="h-4 w-4" /> Skapa testvikarier ({testSubstitutes.length})
            </Button>
            <Button onClick={createTestRequests} disabled={loading} variant="outline">
              <Plus className="h-4 w-4" /> Skapa testförfrågningar ({testSchoolRequests.length})
            </Button>
            <Button onClick={downloadLoginCsv} disabled={loading || testSubstitutes.length === 0} variant="outline">
              <Download className="h-4 w-4" /> Ladda ned testinloggningar
            </Button>
          </div>

          {createdEmails.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-green-900">{createdEmails.length} testvikarier skapade</p>
                  <p className="text-sm text-green-700">Lösenord: <code className="bg-white px-2 py-1 rounded">TestPassword123!</code></p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowEmails(!showEmails)}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  {showEmails ? "Dölj" : "Visa"} e-poster
                </Button>
              </div>
              {showEmails && (
                <div className="mt-3 space-y-1 bg-white p-3 rounded text-sm font-mono text-gray-700">
                  {createdEmails.map(email => (
                    <div key={email}>{email}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            onClick={clearAllData}
            disabled={loading}
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="h-4 w-4" /> Radera all testdata
          </Button>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold mb-2">Testdata information:</p>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Skolor:</strong> {testSchools.length} testskolor med kontaktuppgifter</li>
              <li>• <strong>Vikarier:</strong> {testSubstitutes.length} testpersoner med olika ämnen</li>
              <li>• <strong>Förfrågningar:</strong> {testSchoolRequests.length} testförfrågningar från skolor</li>
              <li>• <strong>Lösenord:</strong> TestPassword123! för alla testvikarier</li>
              <li>• <strong>Status:</strong> Testvikarier skapas redan godkända och med godkänd bakgrundskontroll</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Feedback ---------------- */

const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  bugg: "Något funkar inte",
  ide: "Idé / önskemål",
  upplevelse: "Allmän upplevelse",
  annat: "Annat",
};

type FeedbackRow = {
  id: string;
  role: string;
  category: string;
  message: string;
  score: number | null;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
};

function FeedbackTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feedbackTable = () => (supabase as any).from("feedback");

  const { data: feedback = [], isLoading } = useQuery<FeedbackRow[]>({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const { data, error } = await feedbackTable()
        .select("id, role, category, message, score, created_at, profiles(full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FeedbackRow[];
    },
  });

  const avgScore =
    feedback.filter((f) => f.score != null).length > 0
      ? (
          feedback.reduce((sum, f) => sum + (f.score ?? 0), 0) /
          feedback.filter((f) => f.score != null).length
        ).toFixed(1)
      : null;

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Kundfeedback</CardTitle>
          <CardDescription>
            {feedback.length} synpunkter insamlade
            {avgScore ? ` · snittbetyg ${avgScore}/5` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Laddar…</p>
          ) : feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ingen feedback ännu. Användare hittar formuläret under "Feedback" i menyn.
            </p>
          ) : (
            <ul className="space-y-3">
              {feedback.map((f) => (
                <li key={f.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {FEEDBACK_CATEGORY_LABELS[f.category] ?? f.category}
                      </Badge>
                      <Badge variant="outline">
                        {f.role === "school" ? "Skola" : "Vikarie"}
                      </Badge>
                      {f.score != null && (
                        <span className="flex items-center gap-1 text-sm font-medium">
                          {f.score}
                          <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(f.created_at).toLocaleString("sv-SE")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{f.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {f.profiles?.full_name || "Okänd"} · {f.profiles?.email}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
