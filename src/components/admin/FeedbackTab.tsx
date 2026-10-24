import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

export function FeedbackTab() {
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
