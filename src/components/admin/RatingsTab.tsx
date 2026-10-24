import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function RatingsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-ratings"],
    queryFn: async () => {
      const [subs, schools] = await Promise.all([
        supabase
          .from("ratings")
          .select(
            "id, score, comment, created_at, profiles(full_name), assignments(subject, assignment_date, schools(name))",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("school_ratings")
          .select(
            "id, score, comment, created_at, schools(name), assignments(subject, assignment_date)",
          )
          .order("created_at", { ascending: false }),
      ]);
      return { subs: subs.data ?? [], schools: schools.data ?? [] };
    },
  });

  async function remove(table: "ratings" | "school_ratings", id: string) {
    if (!window.confirm("Ta bort omdömet?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast.error("Kunde inte ta bort omdömet");
    else {
      toast.success("Omdömet är borttaget");
      qc.invalidateQueries({ queryKey: ["admin-ratings"] });
    }
  }

  const Row = ({
    title,
    sub,
    score,
    comment,
    onDelete,
  }: {
    title: string;
    sub: string;
    score: number;
    comment: string | null;
    onDelete: () => void;
  }) => (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-2 pt-6">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{sub}</p>
          <p className="mt-1 flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-4 w-4 ${n <= score ? "fill-accent text-accent" : "text-muted-foreground"}`}
              />
            ))}
          </p>
          {comment && <p className="mt-1 text-sm">{comment}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> Ta bort
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="mt-4 grid gap-6">
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Betyg på vikarier</h2>
        {!data?.subs.length && <p className="text-muted-foreground">Inga betyg än.</p>}
        {data?.subs.map((r) => (
          <Row
            key={r.id}
            title={r.profiles?.full_name || "Vikarie"}
            sub={`${r.assignments?.schools?.name ?? "—"} · ${r.assignments?.subject ?? ""} ${r.assignments?.assignment_date ?? ""}`}
            score={r.score}
            comment={r.comment}
            onDelete={() => remove("ratings", r.id)}
          />
        ))}
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Betyg på skolor</h2>
        {!data?.schools.length && <p className="text-muted-foreground">Inga betyg än.</p>}
        {data?.schools.map((r) => (
          <Row
            key={r.id}
            title={r.schools?.name ?? "Skola"}
            sub={`${r.assignments?.subject ?? ""} ${r.assignments?.assignment_date ?? ""}`}
            score={r.score}
            comment={r.comment}
            onDelete={() => remove("school_ratings", r.id)}
          />
        ))}
      </section>
    </div>
  );
}

/* ---------------- Skolor ---------------- */
