import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABELS, SUBJECTS, formatTime } from "@/lib/subjects";

export function AssignmentsTab() {
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
