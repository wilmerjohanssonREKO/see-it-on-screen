import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { sv } from "date-fns/locale";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { CalendarDays, Clock, MapPin, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS, formatTime } from "@/lib/subjects";
import { RatingSummary, StarRatingForm } from "@/components/StarRating";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/uppdrag")({
  beforeLoad: async () => {
    const { data } = await supabase.rpc("my_school_id");
    if (data) throw redirect({ to: "/skola" });
  },
  head: () => ({
    meta: [
      { title: "Schema — REKO UF" },
      {
        name: "description",
        content: "Se alla öppna vikariebehov och tacka ja till uppdrag hos REKO UF.",
      },
      { property: "og:title", content: "Schema — REKO UF" },
      { property: "og:description", content: "Vikariebehov du kan tacka ja till." },
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
};

function UppdragPage() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const qc = useQueryClient();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["my-assignments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("substitute_assignments");
      if (error) throw error;
      return (data ?? []) as AssignmentRow[];
    },
  });

  // Log once per assignment that the substitute has seen it (server-side write).
  const loggedViews = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const a of rows ?? []) {
      if (!loggedViews.current.has(a.id)) {
        loggedViews.current.add(a.id);
        void supabase.rpc("log_assignment_view", { p_assignment_id: a.id });
      }
    }
  }, [rows]);

  const claim = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data, error } = await supabase.rpc("claim_assignment", {
        p_assignment_id: assignmentId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (result) => {
      if (result === "claimed") toast.success("Du har fått uppdraget! Vi hör av oss till skolan.");
      else if (result === "already_filled") toast.error("Redan tillsatt");
      else toast.error("Din profil är inte godkänd ännu");
      qc.invalidateQueries({ queryKey: ["my-assignments"] });
    },
    onError: () => toast.error("Något gick fel, försök igen"),
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

  const [selected, setSelected] = useState<Date | undefined>();
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
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const subjectsInList = useMemo(
    () => Array.from(new Set((rows ?? []).map((a) => a.subject))).sort((x, y) => x.localeCompare(y, "sv")),
    [rows],
  );
  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
  const visible = (rows ?? [])
    .filter((a) => (selectedKey ? a.assignment_date === selectedKey : true))
    .filter((a) => subjectFilter === "all" || a.subject === subjectFilter)
    .sort((a, b) => (a.assignment_date + a.start_time).localeCompare(b.assignment_date + b.start_time));

  const approved = profile?.approved && profile?.background_status === "approved";
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold">Schema</h1>
        <p className="mt-1 text-muted-foreground">
          {firstName ? `God dag, ${firstName}` : "God dag"}
        </p>


        {!approved && (
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
              onSelect={setSelected}
              modifiers={{ mine: mineDays, available: openDays }}
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
          {subjectsInList.length > 1 && (
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-full sm:w-64" aria-label="Filtrera på ämne">
                <SelectValue placeholder="Alla ämnen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla ämnen</SelectItem>
                {subjectsInList.map((sub) => (
                  <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selected && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Visar {format(selected, "d MMMM", { locale: sv })}</span>
              <Button size="sm" variant="outline" onClick={() => setSelected(undefined)}>Visa alla</Button>
            </div>
          )}
          {selected && visible.length === 0 && (
            <p className="text-center text-muted-foreground">Inga jobb den här dagen.</p>
          )}
          {isLoading && <p className="text-muted-foreground">Laddar…</p>}
          {!isLoading && (rows?.length ?? 0) === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Inga öppna uppdrag just nu.
              </CardContent>
            </Card>
          )}
          {visible.map((a) => {
            const mine = a.assigned_to_me;
            return (
              <Card key={a.id} className="shadow-soft">
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
                  {a.status === "open" ? (
                    <Button
                      className="w-full sm:w-auto"
                      variant="accent"
                      disabled={!approved || claim.isPending}
                      onClick={() => claim.mutate(a.id)}
                    >
                      Jag kan
                    </Button>
                  ) : (
                    <p className="text-sm font-medium">
                      {mine ? "Du är tilldelad detta uppdrag." : "Redan tillsatt"}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        </div>
      </main>
    </div>
  );
}
