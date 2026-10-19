import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createSchoolLogin } from "@/lib/school-admin.functions";
import { deleteUserCompletely } from "@/lib/user-admin.functions";
import { getCvSignedUrl } from "@/lib/cv.functions";
import { generateSchoolCode, listTeachers, removeTeacher } from "@/lib/teacher.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, FileText, Plus, Send, Star, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { AddressFields } from "@/components/AddressFields";
import { DataTab } from "@/components/admin/DataTab";
import { schoolContactSchema } from "@/lib/contact-schemas";
import { saveSchoolContact } from "@/lib/contact.functions";
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
          "Lägg upp vikariebehov, godkänn vikarier, hantera skolkonton och lärare i REKO UF:s adminpanel.",
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
        <p className="mt-1 text-muted-foreground">Hantera behov, vikarier, skolor och lärare.</p>
        <Tabs defaultValue="behov" className="mt-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="behov">Vikariebehov</TabsTrigger>
            <TabsTrigger value="vikarier">Vikarier</TabsTrigger>
            <TabsTrigger value="skolor">Skolor</TabsTrigger>
            <TabsTrigger value="larare">Lärare</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>
          <TabsContent value="behov">
            <AssignmentsTab />
          </TabsContent>
          <TabsContent value="vikarier">
            <SubstitutesTab />
          </TabsContent>
          <TabsContent value="skolor">
            <SchoolsTab />
          </TabsContent>
          <TabsContent value="larare">
            <TeachersTab />
          </TabsContent>
          <TabsContent value="feedback">
            <FeedbackTab />
          </TabsContent>
          <TabsContent value="data">
            <DataTab />
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
          const sub = a.profiles as {
            full_name: string;
            email: string;
            phone: string | null;
          } | null;
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

/* ---------------- Vikarier ---------------- */

function SubstitutesTab() {
  const deleteUser = useServerFn(deleteUserCompletely);
  const getCvUrl = useServerFn(getCvSignedUrl);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["substitutes"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: members }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("school_members").select("user_id"),
      ]);
      if (error) throw error;
      const schoolUsers = new Set((members ?? []).map((m) => m.user_id));
      return (profiles ?? []).filter((p) => !schoolUsers.has(p.id));
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
    if (!window.confirm("Ta bort vikarien helt, inklusive inlogg? Det går inte att ångra.")) return;
    try {
      await deleteUser({ data: { userId: id } });
      toast.success("Vikarie borttagen");
      qc.invalidateQueries({ queryKey: ["substitutes"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte ta bort vikarien");
    }
  }

  async function openCv(substituteId: string) {
    try {
      const { url } = await getCvUrl({ data: { substituteId } });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte öppna CV:t");
    }
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
                <Badge variant="outline">{p.cv_file_path ? "CV uppladdat" : "Inget CV"}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {p.school_name ?? "—"} {p.graduation_year ? `· examen ${p.graduation_year}` : ""}
            </p>
            {p.street_address && (
              <p className="text-sm text-muted-foreground">
                {p.street_address}, {p.postal_code} {p.city}
              </p>
            )}
            <p className="text-sm">Ämnen: {p.subjects.join(", ") || "inga valda"}</p>
            {p.availability && (
              <p className="text-sm text-muted-foreground">Tillgänglighet: {p.availability}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!p.approved && (p.background_status !== "approved" || !p.phone || !p.full_name)}
                title={p.background_status !== "approved" ? "Kontrollera utdraget och sätt status till Godkänd först" : undefined}
                onClick={() => update(p.id, { approved: !p.approved })}
              >
                {p.approved
                  ? "Ta bort godkännande"
                  : p.background_status === "approved"
                    ? "Godkänn vikarie"
                    : "Utdrag ej kontrollerat"}
              </Button>
              <Select
                value={p.background_status}
                onValueChange={(v) =>
                  update(p.id, { background_status: v as "pending" | "approved" | "needs_renewal" })
                }
              >
                <SelectTrigger className="h-8 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Väntar granskning</SelectItem>
                  <SelectItem value="approved">Utdrag kontrollerat</SelectItem>
                  <SelectItem value="needs_renewal">Behöver förnyas</SelectItem>
                </SelectContent>
              </Select>
              {p.cv_file_path && (
                <Button size="sm" variant="ghost" onClick={() => openCv(p.id)}>
                  <FileText className="h-4 w-4" /> Visa CV
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
  const saveContact = useServerFn(saveSchoolContact);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const editing = data?.find((school) => school.id === editingId);
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = schoolContactSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Kontrollera uppgifterna");
      return;
    }
    setSaving(true);
    try {
      const result = await saveContact({ data: { ...parsed.data, id: editingId ?? undefined } });
      toast.success(editingId ? "Skoluppgifterna är uppdaterade" : "Skola tillagd");
      if (result?.geoWarning)
        toast.warning("Kunde inte hitta positionen för postnumret — avståndsmatchning fungerar inte för den här adressen ännu");
      form.reset();
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["schools"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara skolan");
    } finally {
      setSaving(false);
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
          <CardTitle>{editingId ? "Ändra skoluppgifter" : "Lägg till skola"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form key={editingId ?? "new"} className="grid gap-4 sm:grid-cols-2" onSubmit={add}>
            <div className="grid gap-2">
              <Label htmlFor="name">Namn</Label>
              <Input
                id="name"
                name="name"
                defaultValue={editing?.name ?? ""}
                maxLength={120}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_person">Kontaktperson</Label>
              <Input
                id="contact_person"
                name="contact_person"
                defaultValue={editing?.contact_person ?? ""}
                maxLength={120}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={editing?.email ?? ""}
                maxLength={255}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={editing?.phone ?? ""}
                minLength={5}
                maxLength={40}
                required
                pattern="[+0-9 ()-]+"
              />
            </div>
            <AddressFields values={editing} prefix="school-address" />
            <Button type="submit" className="sm:col-span-2" disabled={saving}>
              {saving ? "Sparar…" : "Spara skola"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                Avbryt
              </Button>
            )}
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
              <p className="mt-2 text-sm text-muted-foreground">
                {s.street_address
                  ? `${s.street_address}, ${s.postal_code ?? ""} ${s.city ?? ""}`
                  : "Adress saknas"}
              </p>
              <Button
                className="mt-3"
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingId(s.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Ändra uppgifter
              </Button>
              <SchoolLoginForm schoolId={s.id} defaultEmail={s.email ?? ""} />
              <SchoolCodeButton schoolId={s.id} />
            </CardContent>
          </Card>
        ))}
      </div>
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
                      <Badge variant="outline">{f.role === "school" ? "Skola" : "Vikarie"}</Badge>
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

function SchoolLoginForm({ schoolId, defaultEmail }: { schoolId: string; defaultEmail: string }) {
  const create = useServerFn(createSchoolLogin);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    try {
      await create({
        data: {
          schoolId,
          email: String(fd.get("email") ?? ""),
          password: String(fd.get("password") ?? ""),
        },
      });
      toast.success("Inlogg skapat! Skicka uppgifterna till skolan.");
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte skapa inlogg");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_auto]"
    >
      <Input
        name="email"
        type="email"
        placeholder="Skolans inlogg (e-post)"
        defaultValue={defaultEmail}
        required
        maxLength={255}
      />
      <Input
        name="password"
        type="text"
        placeholder="Lösenord (minst 8 tecken)"
        required
        minLength={8}
        maxLength={72}
      />
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Skapar…" : "Skapa skolinlogg"}
      </Button>
    </form>
  );
}

function SchoolCodeButton({ schoolId }: { schoolId: string }) {
  const gen = useServerFn(generateSchoolCode);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    if (
      !window.confirm(
        "Generera ny skolkod? Den gamla koden slutar fungera för nya lärare (redan registrerade lärare behåller åtkomst).",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await gen({ data: { schoolId } });
      setCode(res.code);
    } catch {
      toast.error("Kunde inte generera kod");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <Button type="button" size="sm" variant="outline" onClick={run} disabled={busy}>
        {busy ? "Genererar…" : "Generera ny kod"}
      </Button>
      {code ? (
        <span className="text-sm">
          Skolkod:{" "}
          <code className="rounded bg-secondary px-2 py-1 font-mono font-semibold">{code}</code>{" "}
          <span className="text-muted-foreground">— visas bara nu, ge den till skolan.</span>
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">
          Lärare använder skolkoden för att skapa konto.
        </span>
      )}
    </div>
  );
}

function TeachersTab() {
  const qc = useQueryClient();
  const fetchTeachers = useServerFn(listTeachers);
  const remove = useServerFn(removeTeacher);
  const { data } = useQuery({ queryKey: ["admin-teachers"], queryFn: () => fetchTeachers() });
  async function del(userId: string) {
    if (!window.confirm("Ta bort läraren från skolan? Hen kan inte längre publicera vikariebehov."))
      return;
    try {
      await remove({ data: { userId } });
      toast.success("Läraren är borttagen. Generera gärna en ny skolkod så att koden inte kan användas igen.");
      qc.invalidateQueries({ queryKey: ["admin-teachers"] });
    } catch {
      toast.error("Kunde inte ta bort läraren");
    }
  }
  return (
    <div className="mt-4 grid gap-3">
      {data?.length === 0 && <p className="text-muted-foreground">Inga lärarkonton än.</p>}
      {data?.map((t) => (
        <Card key={t.userId}>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-6">
            <div>
              <p className="font-semibold">
                {t.name || "—"} · {t.schoolName}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.email}
                {t.phone ? ` · ${t.phone}` : ""}
              </p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => del(t.userId)}>
              <Trash2 className="h-4 w-4" /> Ta bort
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
