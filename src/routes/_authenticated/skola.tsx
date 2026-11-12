import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Send } from "lucide-react";

import { getCvForAssignment } from "@/lib/cv-school.functions";
import { SubstituteAvatar } from "@/components/SubstituteAvatar";
import { RatingSummary, StarRatingForm } from "@/components/StarRating";

import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
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
import { AssignmentApplicants } from "@/components/booking/AssignmentApplicants";
import { CancellationRequest } from "@/components/booking/CancellationRequest";

export const Route = createFileRoute("/_authenticated/skola")({
  beforeLoad: async () => {
    const { data, error } = await supabase.rpc("my_school_id");
    if (error) throw new Error("Kunde inte kontrollera skolbehörigheten. Försök igen.");
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

type SchoolAssignment = {
  id: string; subject: string; assignment_date: string; start_time: string; end_time: string;
  description: string | null; compensation: string | null; status: string; substitute_id: string | null;
  substitute_name: string | null; substitute_phone: string | null; substitute_rating_avg: number | null;
  substitute_rating_count: number; completed: boolean; rated: boolean; created_at: string;
  applicant_count: number; cancellation_status: string | null; has_cv: boolean;
};
const PAGE_SIZE = 25;

function CvButton({ assignmentId }: { assignmentId: string }) {
  const getCv = useServerFn(getCvForAssignment);
  const [busy, setBusy] = useState(false);
  return <Button type="button" size="sm" className="min-h-11" variant="outline" disabled={busy} onClick={async () => {
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    setBusy(true);
    try {
      const { url } = await getCv({ data: { assignmentId } });
      if (!url) throw new Error("CV saknas");
      if (tab) tab.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch { tab?.close(); toast.error("Kunde inte öppna CV:t"); }
    finally { setBusy(false); }
  }}><FileText className="h-4 w-4" /> {busy ? "Öppnar…" : "Läs CV"}</Button>;
}

function SchoolPage() {
  const { schoolId } = Route.useRouteContext();
  const { user } = useAuth();
  const userId = user?.id;
  const [page, setPage] = useState(0);
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);

  const schoolQuery = useQuery({
    queryKey: ["my-school", userId, schoolId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("name, street_address, postal_code, city")
        .eq("id", schoolId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const school = schoolQuery.data;
  const listQuery = useQuery({
    queryKey: ["school-assignments", userId, schoolId, page],
    enabled: !!userId,
    queryFn: () => bookingRpc<SchoolAssignment[]>("school_assignments_page", { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
    refetchInterval: 15_000,
  });
  const list = listQuery.data;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!subject) {
      toast.error("Välj ämne");
      return;
    }
    setBusy(true);
    const { data: count, error } = await supabase.rpc("create_and_publish_assignment", {
      p_subject: subject,
      p_date: String(fd.get("date")),
      p_start: String(fd.get("start")),
      p_end: String(fd.get("end")),
      p_compensation: String(fd.get("compensation") ?? ""),
      p_description: String(fd.get("description") ?? ""),
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("Sluttiden") ? error.message : "Kunde inte publicera behovet. Försök igen.",
      );
      return;
    }
    toast.success(`Publicerat! Behovet är tillgängligt för ${count ?? 0} godkända vikarier.`);
    setPage(0);
    form.reset();
    setSubject("");
    qc.invalidateQueries({ queryKey: ["school-assignments"] });
  }

  async function rate(id: string, score: number, comment: string) {
    const { error } = await supabase.rpc("rate_substitute", {
      p_assignment_id: id,
      p_score: score,
      p_comment: comment,
    });
    if (error) {
      toast.error(error.message || "Kunde inte spara betyget");
      return;
    }
    toast.success("Tack för ditt betyg!");
    qc.invalidateQueries({ queryKey: ["school-assignments"] });
  }


  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-8">
        <div>
          <h1 className="font-display text-3xl font-bold">{school?.name ?? "Er skola"}</h1>
          {school?.street_address && (
            <p className="mt-1 text-sm text-muted-foreground">
              {school.street_address}, {school.postal_code} {school.city}
            </p>
          )}
          <p className="text-muted-foreground">Lägg upp ett vikariebehov och välj bland intresserade vikarier.</p>
          {schoolQuery.isError && <QueryError retry={() => { void schoolQuery.refetch(); }} message="Kunde inte hämta skolans uppgifter." />}
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Nytt vikariebehov</CardTitle>
            <CardDescription>Vikarier anmäler intresse. Ni granskar profiler och väljer vem som får uppdraget.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-6 [&_input]:min-h-11 [&_button]:min-h-11" onSubmit={submit}>
              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-3 font-semibold">Ämne och tid</legend>
              <div className="grid gap-2">
                <Label htmlFor="school-subject">Ämne</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger id="school-subject">
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
                <Label htmlFor="date">Datum</Label>
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:col-span-2">
              <div className="grid gap-2">
                <Label htmlFor="start">Från</Label>
                <Input id="start" name="start" type="time" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end">Till</Label>
                <Input id="end" name="end" type="time" required />
              </div>
              </div>
              </fieldset>
              <fieldset className="grid gap-4 border-t border-border pt-4">
                <legend className="font-semibold">Valfria uppgifter</legend>
              <div className="grid gap-2">
                <Label htmlFor="compensation">Ersättning (valfritt)</Label>
                <Input id="compensation" name="compensation" maxLength={120} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Beskrivning (valfritt)</Label>
                <Textarea
                  id="description"
                  name="description"
                  maxLength={1000}
                  placeholder="Klass, lokal, vad som ska göras…"
                />
              </div>
              </fieldset>
              <Button type="submit" disabled={busy}>
                <Send className="h-4 w-4" /> {busy ? "Publicerar…" : "Publicera vikariebehov"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <section className="grid gap-3">
          <h2 className="font-display text-xl font-semibold">Era vikariebehov</h2>
          <p className="text-sm text-muted-foreground">Uppdateras automatiskt var 15:e sekund.</p>
          {listQuery.isPending && <p role="status">Hämtar era uppdrag…</p>}
          {listQuery.isError && <QueryError retry={() => { void listQuery.refetch(); }} message="Kunde inte hämta era uppdrag." />}
          {!listQuery.isPending && !listQuery.isError && list?.length === 0 && <p className="text-muted-foreground">Inga behov än.</p>}
          {list?.map((a) => (
            <Card key={a.id}>
              <CardContent className="grid gap-3 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {a.substitute_id && <SubstituteAvatar id={a.substitute_id} name={a.substitute_name} />}
                <div>
                  <p className="font-semibold">
                    {a.subject} · {a.assignment_date}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(a.start_time)}–{formatTime(a.end_time)}
                    {a.substitute_name
                      ? ` · Vikarie: ${a.substitute_name}${a.substitute_phone ? ` (${a.substitute_phone})` : ""}`
                      : ""}
                  </p>
                  {a.substitute_id && (
                    <RatingSummary avg={a.substitute_rating_avg} count={a.substitute_rating_count} />
                  )}
                </div>
                </div>
                  <Badge variant={a.status === "open" ? "secondary" : "default"}>
                    {STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] ?? a.status}
                  </Badge>
              </div>
                <div className="flex flex-wrap items-center gap-3">
                  {a.status === "filled" && a.has_cv && !a.completed && (
                    <CvButton assignmentId={a.id} />
                  )}

                </div>
                {a.status === "open" && !hasAssignmentStarted(a.assignment_date, a.start_time) && userId && (
                  <AssignmentApplicants assignmentId={a.id} schoolId={schoolId} userId={userId} count={a.applicant_count} />
                )}
                {(a.cancellation_status || ((a.status === "open" || a.status === "filled") && !hasAssignmentStarted(a.assignment_date, a.start_time))) && (
                  <CancellationRequest assignmentId={a.id} status={a.cancellation_status} canRequest={(a.status === "open" || a.status === "filled") && !hasAssignmentStarted(a.assignment_date, a.start_time)} />
                )}
                {a.completed && !a.rated && a.substitute_id && (
                  <StarRatingForm label="Betygsätt vikarien" onSubmit={(score, comment) => rate(a.id, score, comment)} />
                )}
                {a.completed && a.rated && <p className="text-sm text-muted-foreground">Ni har betygsatt vikarien.</p>}
              </CardContent>
            </Card>
          ))}
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" disabled={page === 0 || listQuery.isFetching} onClick={() => setPage((p) => p - 1)}>Föregående</Button>
            <span className="text-sm text-muted-foreground">Sida {page + 1}</span>
            <Button type="button" variant="outline" disabled={listQuery.isFetching || !list || list.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Nästa</Button>
          </div>
        </section>
      </main>
    </div>
  );
}
