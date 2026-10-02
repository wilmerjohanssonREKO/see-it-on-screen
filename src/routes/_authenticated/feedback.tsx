import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquareHeart, Star } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/feedback")({
  head: () => ({
    meta: [
      { title: "Ge feedback — REKO UF" },
      {
        name: "description",
        content: "Berätta vad du tycker om REKO UF — dina synpunkter hjälper oss att bygga en bättre vikarieförmedling.",
      },
      { property: "og:title", content: "Ge feedback — REKO UF" },
      { property: "og:description", content: "Dina synpunkter hjälper oss att förbättra REKO UF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeedbackPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  bugg: "Något funkar inte",
  ide: "Idé / önskemål",
  upplevelse: "Allmän upplevelse",
  annat: "Annat",
};

// feedback-tabellen finns inte i de autogenererade typerna ännu
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const feedbackTable = () => (supabase as any).from("feedback");

type FeedbackRow = {
  id: string;
  category: string;
  message: string;
  score: number | null;
  created_at: string;
};

function FeedbackPage() {
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("upplevelse");
  const [score, setScore] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: myFeedback = [] } = useQuery<FeedbackRow[]>({
    queryKey: ["my-feedback", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await feedbackTable()
        .select("id, category, message, score, created_at")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FeedbackRow[];
    },
  });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session?.user.id) return;
    if (message.trim().length < 5) {
      toast.error("Skriv gärna några fler ord så vi förstår vad du menar.");
      return;
    }
    setSaving(true);
    const { error } = await feedbackTable().insert({
      user_id: session.user.id,
      role: profile?.school_name ? "school" : "substitute",
      category,
      message: message.trim(),
      score: score ? Number(score) : null,
    });
    setSaving(false);
    if (error) {
      toast.error("Kunde inte skicka feedbacken. Försök igen.");
      return;
    }
    toast.success("Tack för din feedback! ⭐");
    setMessage("");
    setScore("");
    queryClient.invalidateQueries({ queryKey: ["my-feedback"] });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <MessageSquareHeart className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Ge feedback</h1>
            <p className="text-sm text-muted-foreground">
              Vi bygger REKO UF tillsammans med er — alla synpunkter är guld värda.
            </p>
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Din synpunkt</CardTitle>
            <CardDescription>Vad funkar bra? Vad saknas? Vad är krångligt?</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Betyg (valfritt)</Label>
                  <Select value={score} onValueChange={setScore}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj 1–5" />
                    </SelectTrigger>
                    <SelectContent>
                      {["1", "2", "3", "4", "5"].map((n) => (
                        <SelectItem key={n} value={n}>
                          <span className="flex items-center gap-1">
                            {n} <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-message">Meddelande</Label>
                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="T.ex. Det var lätt att hitta uppdrag, men jag skulle vilja få ett mejl när ett nytt uppdrag publiceras…"
                  rows={5}
                  maxLength={1000}
                  required
                />
                <p className="text-right text-xs text-muted-foreground">{message.length}/1000</p>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Skickar…" : "Skicka feedback"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {myFeedback.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Din tidigare feedback</h2>
            <ul className="mt-3 space-y-3">
              {myFeedback.map((f) => (
                <li key={f.id}>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">{CATEGORY_LABELS[f.category] ?? f.category}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(f.created_at).toLocaleDateString("sv-SE")}
                          {f.score ? ` · ${f.score}/5` : ""}
                        </span>
                      </div>
                      <p className="mt-2 text-sm">{f.message}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
