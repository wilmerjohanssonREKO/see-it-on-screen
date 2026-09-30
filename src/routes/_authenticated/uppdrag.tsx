import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Clock, MapPin, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS, formatTime } from "@/lib/subjects";

export const Route = createFileRoute("/_authenticated/uppdrag")({
  head: () => ({
    meta: [
      { title: "Mina förfrågningar — REKO UF" },
      {
        name: "description",
        content: "Se vikariebehov du matchats mot och tacka ja till uppdrag hos REKO UF.",
      },
      { property: "og:title", content: "Mina förfrågningar — REKO UF" },
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
  assigned_substitute_id: string | null;
  schools: { name: string; contact_person: string | null } | null;
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
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, assignment:assignments(id, subject, assignment_date, start_time, end_time, description, compensation, status, assigned_substitute_id, schools(name, contact_person))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((r) => r.assignment as unknown as AssignmentRow)
        .filter(Boolean);
    },
  });

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

  const approved = profile?.approved && profile?.background_status === "approved";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-bold">Mina förfrågningar</h1>
        <p className="mt-1 text-muted-foreground">
          Uppdrag du matchats mot. Först till kvarn gäller.
        </p>

        {!approved && (
          <Card className="mt-6 border-accent bg-accent/15">
            <CardContent className="pt-6 text-sm">
              <p className="font-semibold">Din profil är inte godkänd ännu</p>
              <p className="mt-1 text-muted-foreground">
                Fyll i din profil och ladda upp utdrag ur belastningsregistret. Vi granskar den
                och hör av oss. Först därefter matchas du mot uppdrag.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/profil">Till min profil</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 grid gap-4">
          {isLoading && <p className="text-muted-foreground">Laddar…</p>}
          {!isLoading && (rows?.length ?? 0) === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Inga förfrågningar än. Du får ett meddelande här när ett uppdrag matchar dina
                ämnen.
              </CardContent>
            </Card>
          )}
          {rows?.map((a) => {
            const mine = a.assigned_substitute_id === userId;
            return (
              <Card key={a.id} className="shadow-soft">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-lg">{a.subject}</CardTitle>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" /> {a.schools?.name ?? "Skola"}
                    </p>
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
      </main>
    </div>
  );
}
