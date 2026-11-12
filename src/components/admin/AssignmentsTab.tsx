import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Send } from "lucide-react";
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
import { useAuth } from "@/hooks/useAuth";
import { bookingRpc, hasAssignmentStarted } from "@/lib/booking";
import { QueryError } from "@/components/booking/QueryState";
import { AdminCancellations } from "@/components/booking/AdminCancellations";

type AdminAssignment = {
  id: string; school_id: string; subject: string; assignment_date: string; start_time: string; end_time: string;
  status: string; description: string | null; compensation: string | null; assigned_substitute_id: string | null;
  school_name: string; school_contact_person: string | null; school_email: string | null; school_phone: string | null;
  substitute_name: string | null; substitute_email: string | null; substitute_phone: string | null; notified_count: number;
};
const PAGE_SIZE = 25;

export function AssignmentsTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [subject, setSubject] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [saving, setSaving] = useState(false);

  const schoolsQuery = useQuery({
    queryKey: ["admin-assignment-schools", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const schools = schoolsQuery.data;
  const assignmentsQuery = useQuery({
    queryKey: ["assignments", user?.id, page], enabled: !!user?.id,
    queryFn: () => bookingRpc<AdminAssignment[]>("admin_assignments_page", { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
    refetchInterval: 15_000,
  });
  const assignments = assignmentsQuery.data;

  async function createAssignment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schoolId || !subject) {
      toast.error("Välj skola och ämne");
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    try {
      const count = await bookingRpc<number>("admin_create_and_publish_assignment", {
        p_school_id: schoolId, p_subject: subject, p_date: String(fd.get("assignment_date")),
        p_start: String(fd.get("start_time")), p_end: String(fd.get("end_time")),
        p_description: String(fd.get("description") ?? ""), p_compensation: String(fd.get("compensation") ?? ""),
      });
      toast.success(`Publicerat – ${count ?? 0} godkända vikarier kan se behovet.`);
      form.reset(); setSubject(""); setPage(0);
      void qc.invalidateQueries({ queryKey: ["assignments"] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Kunde inte publicera behovet"); }
    finally { setSaving(false); }
  }

  async function changeStatus(id: string, reopen: boolean) {
    const question = reopen ? "Öppna uppdraget igen? Tidigare tilldelning tas bort och vikarier behöver anmäla intresse på nytt." : "Avsluta behovet? Det finns kvar i historiken.";
    if (!window.confirm(question)) return;
    setUpdating(true);
    try {
      const changed = await bookingRpc<boolean>(reopen ? "admin_reopen_assignment" : "admin_expire_assignment", { p_assignment_id: id });
      if (!changed) throw new Error("Uppdraget kunde inte uppdateras. Hämta aktuell status och försök igen.");
      toast.success(reopen ? "Uppdraget är öppet igen." : "Behovet är avslutat.");
      for (const key of ["assignments", "school-assignments", "my-assignments", "admin-cancellations"]) void qc.invalidateQueries({ queryKey: [key] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Kunde inte uppdatera behovet"); }
    finally { setUpdating(false); }
  }

  return (
    <div className="mt-4 grid gap-6">
      <AdminCancellations />
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Nytt vikariebehov
          </CardTitle>
          <CardDescription>
            Publicera behovet för godkända vikarier. Skolan väljer bland intresseanmälningarna.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schoolsQuery.isPending ? <p role="status">Hämtar skolor…</p> : schoolsQuery.isError ? <QueryError retry={() => { void schoolsQuery.refetch(); }} message="Kunde inte hämta skolorna." /> : (schools?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Lägg till en skola under fliken Skolor först.
            </p>
          ) : (
            <form className="grid gap-6 [&_input]:min-h-11 [&_button]:min-h-11" onSubmit={createAssignment}>
              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-3 font-semibold">Skola, ämne och tid</legend>
                <div className="grid gap-2">
                  <Label htmlFor="admin-school">Skola</Label>
                  <Select value={schoolId} onValueChange={setSchoolId}>
                    <SelectTrigger id="admin-school">
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
                  <Label htmlFor="admin-subject">Ämne</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger id="admin-subject">
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
                <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                <div className="grid gap-2">
                  <Label htmlFor="start_time">Från</Label>
                  <Input id="start_time" name="start_time" type="time" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_time">Till</Label>
                  <Input id="end_time" name="end_time" type="time" required />
                </div>
                </div>
              </fieldset>
              <fieldset className="grid gap-4 border-t border-border pt-4">
                <legend className="font-semibold">Valfria uppgifter</legend>
              <div className="grid gap-2">
                <Label htmlFor="compensation">Ersättning (valfritt)</Label>
                <Input id="compensation" name="compensation" placeholder="T.ex. 180 kr/tim" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Beskrivning (valfritt)</Label>
                <Textarea id="description" name="description" rows={3} maxLength={1000} />
              </div>
              </fieldset>
              <Button type="submit" disabled={saving}>
                <Send className="h-4 w-4" />
                {saving ? "Publicerar…" : "Publicera vikariebehov"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Uppdrag</h2>
        {assignmentsQuery.isPending && <p role="status">Hämtar uppdrag…</p>}
        {assignmentsQuery.isError && <QueryError retry={() => { void assignmentsQuery.refetch(); }} message="Kunde inte hämta uppdragen." />}
        {!assignmentsQuery.isPending && !assignmentsQuery.isError && !assignments?.length && <p className="text-sm text-muted-foreground">Inga uppdrag på den här sidan.</p>}
        {assignments?.map((a) => <Card key={a.id}>
          <CardContent className="grid gap-3 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="font-semibold">{a.subject} · {a.school_name}</p><p className="text-sm text-muted-foreground">{a.assignment_date} {formatTime(a.start_time)}–{formatTime(a.end_time)} · {a.notified_count} registrerade notiser</p></div>
              <Badge variant={a.status === "open" ? "default" : "secondary"}>{STATUS_LABELS[a.status] ?? a.status}</Badge>
            </div>
            {a.assigned_substitute_id ? <div className="rounded-panel bg-secondary p-3 text-sm">
              <p className="font-medium">Vald vikarie: {a.substitute_name || a.substitute_email || "Borttaget konto"}</p>
              <p className="text-muted-foreground">{a.substitute_email} {a.substitute_phone ? `· ${a.substitute_phone}` : ""}</p>
            </div> : <p className="text-sm text-muted-foreground">Ingen vikarie är vald.</p>}
            {!hasAssignmentStarted(a.assignment_date, a.start_time) && <div className="flex flex-wrap gap-2 [&_button]:min-h-11">
              {a.status !== "expired" && <Button type="button" size="sm" variant="outline" disabled={updating} onClick={() => changeStatus(a.id, false)}>Avsluta behov</Button>}
              {a.status !== "open" && <Button type="button" size="sm" variant="ghost" disabled={updating} onClick={() => changeStatus(a.id, true)}>Öppna igen</Button>}
            </div>}
          </CardContent>
        </Card>)}
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" disabled={!page || assignmentsQuery.isFetching} onClick={() => setPage((p) => p - 1)}>Föregående</Button>
          <span className="text-sm text-muted-foreground">Sida {page + 1}</span>
          <Button type="button" variant="outline" disabled={assignmentsQuery.isFetching || !assignments || assignments.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Nästa</Button>
        </div>
      </section>
    </div>
  );
}
