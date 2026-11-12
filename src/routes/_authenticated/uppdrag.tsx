import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { sv } from "date-fns/locale";
import { format } from "date-fns";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { toast } from "sonner";
import { CalendarDays, Clock, MapPin, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS, SUBJECTS, formatTime } from "@/lib/subjects";
import { RatingSummary, StarRatingForm } from "@/components/StarRating";
import { bookingRpc, APPLICATION_LABELS, hasAssignmentStarted } from "@/lib/booking";
import { QueryError } from "@/components/booking/QueryState";
import { CancellationRequest } from "@/components/booking/CancellationRequest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/uppdrag")({
  beforeLoad: async () => {
    const { data, error } = await supabase.rpc("my_school_id");
    if (error) throw new Error("Kunde inte kontrollera kontobehörigheten. Försök igen.");
    if (data) throw redirect({ to: "/skola" });
  },
  head: () => ({
    meta: [
      { title: "Schema — REKO UF" },
      {
        name: "description",
        content: "Se vikariebehov och anmäl intresse hos REKO UF. Skolan väljer vikarie.",
      },
      { property: "og:title", content: "Schema — REKO UF" },
      { property: "og:description", content: "Vikariebehov du kan anmäla intresse för." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UppdragPage,
});

type AssignmentRow = {
  id: string;
  subject: string;
  assignment_date: string;
  start_time: string;
  end_time: string;
  description: string | null;
  compensation: string | null;
  status: string;
  assigned_to_me: boolean;
  school_name: string;
  school_contact_person: string | null;
  school_phone: string | null;
  school_email: string | null;
  school_rating_avg: number | null;
  school_rating_count: number;
  completed: boolean;
  rated: boolean;
  application_status: string | null;
  cancellation_status: string | null;
};
const PAGE_SIZE = 25;

function UppdragPage() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const qc = useQueryClient();

  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Date | undefined>();
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
  const assignments = useQuery({
    queryKey: ["my-assignments", userId, page, selectedKey, subjectFilter],
    enabled: !!userId,
    queryFn: () => bookingRpc<AssignmentRow[]>("substitute_assignments_page", {
      p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE,
      p_date: selectedKey, p_subject: subjectFilter === "all" ? null : subjectFilter,
    }),
    refetchInterval: 15_000,
  });
  const rows = assignments.data;
  const apply = useMutation({
    mutationFn: (assignmentId: string) => bookingRpc<string>("apply_assignment", { p_assignment_id: assignmentId }),
    onSuccess: (result) => {
      if (result === "applied") toast.success("Intresseanmälan skickad. Skolan väljer vem som får uppdraget.");
      else if (result === "overlap") toast.error("Du har redan ett uppdrag under den här tiden.");
      else if (result === "not_approved") toast.error("Din profil är inte godkänd ännu.");
      else toast.error("Uppdraget är inte längre tillgängligt.");
      void qc.invalidateQueries({ queryKey: ["my-assignments"] });
    },
    onError: (error) => toast.error(error.message || "Kunde inte anmäla intresse"),
  });
  const withdraw = useMutation({
    mutationFn: (assignmentId: string) => bookingRpc<boolean>("withdraw_application", { p_assignment_id: assignmentId }),
    onSuccess: (changed) => {
      if (!changed) { toast.error("Intresseanmälan kunde inte återkallas. Den kan redan vara behandlad."); void qc.invalidateQueries({ queryKey: ["my-assignments"] }); return; }
      toast.success("Din intresseanmälan är återkallad.");
      void qc.invalidateQueries({ queryKey: ["my-assignments"] });
    },
    onError: (error) => toast.error(error.message || "Kunde inte återkalla intresseanmälan"),
  });

  async function rateSchool(id: string, score: number, comment: string) {
    const { error } = await supabase.rpc("rate_school", { p_assignment_id: id, p_score: score, p_comment: comment });
    if (error) {
      toast.error(error.message || "Kunde inte spara betyget");
      return;
    }
    toast.success("Tack för ditt betyg!");
    qc.invalidateQueries({ queryKey: ["my-assignments"] });
  }

  const toDate = (d: string) => new Date(`${d}T00:00:00`);
  const { mineDays, openDays } = useMemo(() => {
    const mine: Date[] = [];
    const open: Date[] = [];
    for (const a of rows ?? []) {
      if (a.assigned_to_me) mine.push(toDate(a.assignment_date));
      else if (a.status === "open") open.push(toDate(a.assignment_date));
    }
    return { mineDays: mine, openDays: open };
  }, [rows]);
  const visible = rows ?? [];
  const loggedViews = useRef<Set<string>>(new Set());
  useEffect(() => { loggedViews.current.clear(); }, [userId]);
  // Log only cards actually entering the viewport. Server deduplicates repeat views.
  useEffect(() => {
    if (!userId || !rows?.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset["assignmentId"];
        if (!entry.isIntersecting || !id || loggedViews.current.has(id)) continue;
        loggedViews.current.add(id);
        observer.unobserve(entry.target);
        void supabase.rpc("log_assignment_view", { p_assignment_id: id }).then(({ error }) => {
          if (error) loggedViews.current.delete(id);
        });
      }
    }, { threshold: 0.25 });
    document.querySelectorAll("[data-assignment-id]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [rows, userId]);

  const approved = profile?.approved && profile?.background_status === "approved";
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold">Schema</h1>
        <p className="mt-1 text-muted-foreground">
          {firstName ? `God dag, ${firstName}` : "God dag"}. Anmäl intresse för ett uppdrag – skolan väljer vikarie.
        </p>


        {profile && !approved && (
          <Card className="mt-6 border-accent bg-accent/15">
            <CardContent className="pt-6 text-sm">
              <p className="font-semibold">Din profil är inte godkänd ännu</p>
              <p className="mt-1 text-muted-foreground">
                Fyll i din profil och visa upp ditt utdrag ur belastningsregistret för oss. Vi granskar
                och hör av oss. Först därefter matchas du mot uppdrag.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/profil">Till min profil</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 grid items-start gap-6 md:grid-cols-[auto_1fr]">
        <Card className="shadow-soft">
          <CardContent className="flex justify-center pt-6">
            <Calendar
              mode="single"
              locale={sv}
              weekStartsOn={1}
              selected={selected}
              onSelect={(date) => { setSelected(date); setPage(0); }}
              modifiers={{ mine: mineDays, available: openDays }}
              components={{
                DayButton: ({ modifiers, ...props }) => (
                  <CalendarDayButton
                    {...props}
                    modifiers={modifiers}
                    aria-label={`${props["aria-label"] ?? format(props.day.date, "d MMMM yyyy", { locale: sv })}${modifiers["mine"] ? ", ditt uppdrag" : ""}${modifiers["available"] ? ", lediga uppdrag" : ""}`}
                    title={modifiers["mine"] && modifiers["available"] ? "Ditt uppdrag och lediga uppdrag" : modifiers["mine"] ? "Ditt uppdrag" : modifiers["available"] ? "Lediga uppdrag" : undefined}
                  >
                    {props.children}
                    {(modifiers["mine"] || modifiers["available"]) && <span aria-hidden="true" className="absolute bottom-0.5 text-[8px] leading-none">{modifiers["mine"] && modifiers["available"] ? "◆ ○" : modifiers["mine"] ? "◆" : "○"}</span>}
                  </CalendarDayButton>
                ),
              }}
              modifiersClassNames={{
                mine: "[&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:font-bold",
                available: "[&_button]:bg-accent/40 [&_button]:font-bold",
              }}
              classNames={{ today: "[&_button]:ring-2 [&_button]:ring-inset [&_button]:ring-foreground/40" }}
              className="[--cell-size:2.5rem]"
            />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Select value={subjectFilter} onValueChange={(value) => { setSubjectFilter(value); setPage(0); }}>
            <SelectTrigger className="min-h-11 w-full sm:w-64" aria-label="Filtrera på ämne"><SelectValue placeholder="Alla ämnen" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Alla ämnen</SelectItem>{SUBJECTS.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">Uppdateras automatiskt var 15:e sekund. Välj ett datum för att se den dagens uppdrag.</p>
          {selected && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Visar {format(selected, "d MMMM", { locale: sv })}</span>
              <Button size="sm" className="min-h-11" variant="outline" onClick={() => { setSelected(undefined); setPage(0); }}>Visa alla</Button>
            </div>
          )}
          {!assignments.isPending && !assignments.isError && selected && visible.length === 0 && (
            <p className="text-center text-muted-foreground">Inga jobb den här dagen.</p>
          )}
          {assignments.isPending && <p role="status" className="text-muted-foreground">Hämtar uppdrag…</p>}
          {assignments.isError && <QueryError retry={() => { void assignments.refetch(); }} message="Kunde inte hämta uppdragen." />}
          {!assignments.isPending && !assignments.isError && !selected && (rows?.length ?? 0) === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Inga öppna uppdrag just nu.
              </CardContent>
            </Card>
          )}
          {visible.map((a) => {
            const mine = a.assigned_to_me;
            return (
              <Card key={a.id} className="shadow-soft" data-assignment-id={a.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-lg">{a.subject}</CardTitle>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" /> {a.school_name}
                    </p>
                    <RatingSummary avg={a.school_rating_avg} count={a.school_rating_count} />
                  </div>
                  <Badge variant={a.status === "open" ? "default" : "secondary"}>
                    {mine ? "Ditt uppdrag" : STATUS_LABELS[a.status]}
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" /> {a.assignment_date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" /> {formatTime(a.start_time)}–
                      {formatTime(a.end_time)}
                    </span>
                    {a.compensation && (
                      <span className="flex items-center gap-1">
                        <Wallet className="h-4 w-4" /> {a.compensation}
                      </span>
                    )}
                  </div>
                  {a.description && <p className="text-sm">{a.description}</p>}
                  {mine && (a.school_contact_person || a.school_phone || a.school_email) && (
                    <p className="text-sm">
                      Kontakt: {[a.school_contact_person, a.school_phone, a.school_email].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {mine && a.completed && !a.rated && (
                    <StarRatingForm label="Betygsätt skolan" onSubmit={(score, comment) => rateSchool(a.id, score, comment)} />
                  )}
                  {mine && a.completed && a.rated && (
                    <p className="text-sm text-muted-foreground">Du har betygsatt skolan.</p>
                  )}
                  {a.application_status && <p role="status" className="text-sm text-muted-foreground">{APPLICATION_LABELS[a.application_status] ?? a.application_status}</p>}
                  {(a.cancellation_status || (mine && !hasAssignmentStarted(a.assignment_date, a.start_time))) && <CancellationRequest assignmentId={a.id} status={a.cancellation_status} canRequest={mine && a.status === "filled" && !hasAssignmentStarted(a.assignment_date, a.start_time)} />}
                  {a.status === "open" && !mine && !hasAssignmentStarted(a.assignment_date, a.start_time) && a.application_status !== "rejected" && (
                    a.application_status === "pending" ? <Button type="button" className="min-h-11 w-full sm:w-auto" variant="outline" disabled={withdraw.isPending} onClick={() => { if (window.confirm("Återkalla din intresseanmälan?")) withdraw.mutate(a.id); }}>Återkalla intresse</Button> :
                    <Button type="button" className="min-h-11 w-full sm:w-auto" variant="accent" disabled={!approved || apply.isPending} onClick={() => apply.mutate(a.id)}>Anmäl intresse</Button>
                  )}
                  {mine && <p className="text-sm font-medium">Du är tilldelad detta uppdrag.</p>}

                </CardContent>
              </Card>
            );
          })}
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" disabled={page === 0 || assignments.isFetching} onClick={() => setPage((p) => p - 1)}>Föregående</Button>
            <span className="text-sm text-muted-foreground">Sida {page + 1}</span>
            <Button type="button" variant="outline" disabled={assignments.isFetching || !rows || rows.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Nästa</Button>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
