import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useAuth, useIsAdmin, useProfile } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BACKGROUND_LABELS, SUBJECTS } from "@/lib/subjects";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Min vikarieprofil — REKO UF" },
      {
        name: "description",
        content:
          "Uppdatera dina ämnen, tillgänglighet och utdrag ur belastningsregistret så vi kan matcha dig mot vikariebehov.",
      },
      { property: "og:title", content: "Min vikarieprofil — REKO UF" },
      { property: "og:description", content: "Ämnen, tillgänglighet och granskning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilPage,
});

function ProfilPage() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: profile, isLoading } = useProfile(userId);
  const { data: isAdmin } = useIsAdmin(userId);
  const qc = useQueryClient();

  const [subjects, setSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile?.subjects) setSubjects(profile.subjects);
  }, [profile?.subjects]);

  const { data: stats } = useQuery({
    queryKey: ["my-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [assignments, ratings] = await Promise.all([
        supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("assigned_substitute_id", userId!),
        supabase.from("ratings").select("score").eq("substitute_id", userId!),
      ]);
      const scores = (ratings.data ?? []).map((r) => r.score);
      return {
        completed: assignments.count ?? 0,
        average: scores.length
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null,
      };
    },
  });

  async function claimAdmin() {
    const { data, error } = await supabase.rpc("claim_first_admin");
    if (error || !data) {
      toast.error("Det finns redan en admin i systemet.");
      return;
    }
    toast.success("Du är nu plattformsadmin.");
    qc.invalidateQueries({ queryKey: ["is-admin"] });
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const year = String(fd.get("graduation_year") ?? "").trim();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: String(fd.get("full_name") ?? "").trim().slice(0, 120),
        email: String(fd.get("email") ?? "").trim().slice(0, 255),
        phone: String(fd.get("phone") ?? "").trim().slice(0, 40) || null,
        school_name: String(fd.get("school_name") ?? "").trim().slice(0, 120) || null,
        graduation_year: year ? Number(year) : null,
        availability: String(fd.get("availability") ?? "").trim().slice(0, 1000) || null,
        subjects,
      })
      .eq("id", userId!);
    setSaving(false);
    if (error) {
      toast.error("Kunde inte spara profilen");
      return;
    }
    toast.success("Profilen är sparad");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("background-checks").upload(path, file);
    if (!error) {
      await supabase.from("profiles").update({ background_file_path: path }).eq("id", userId);
      toast.success("Filen är uppladdad och väntar på granskning");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } else {
      toast.error("Uppladdningen misslyckades");
    }
    setUploading(false);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <p className="p-8 text-muted-foreground">Laddar…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Min profil</h1>
          <div className="flex items-center gap-2">
            <Badge variant={profile?.approved ? "default" : "secondary"}>
              {profile?.approved ? "Godkänd vikarie" : "Väntar godkännande"}
            </Badge>
            <Badge variant="outline">
              Belastningsregister: {BACKGROUND_LABELS[profile?.background_status ?? "pending"]}
            </Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Genomförda uppdrag</p>
              <p className="text-3xl font-bold">{stats?.completed ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Snittbetyg</p>
              <p className="flex items-center gap-2 text-3xl font-bold">
                {stats?.average ?? "–"}
                {stats?.average ? <Star className="h-6 w-6 fill-accent text-accent" /> : null}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 shadow-soft">
          <CardHeader>
            <CardTitle>Uppgifter</CardTitle>
            <CardDescription>Vi använder dessa för att matcha dig mot uppdrag.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSave}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="full_name">Namn</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    defaultValue={profile?.full_name ?? ""}
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
                    defaultValue={profile?.email ?? session?.user.email ?? ""}
                    maxLength={255}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} maxLength={40} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="school_name">Skola du gick på</Label>
                  <Input
                    id="school_name"
                    name="school_name"
                    defaultValue={profile?.school_name ?? ""}
                    maxLength={120}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="graduation_year">Examensår</Label>
                  <Input
                    id="graduation_year"
                    name="graduation_year"
                    type="number"
                    min={1970}
                    max={2100}
                    defaultValue={profile?.graduation_year ?? ""}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Ämnen du kan vikariera i</Label>
                <div className="grid gap-2 rounded-lg border border-border p-4 sm:grid-cols-2">
                  {SUBJECTS.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={subjects.includes(s)}
                        onCheckedChange={(v) =>
                          setSubjects((prev) =>
                            v ? [...prev, s] : prev.filter((x) => x !== s),
                          )
                        }
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="availability">Tillgänglighet</Label>
                <Textarea
                  id="availability"
                  name="availability"
                  rows={3}
                  maxLength={1000}
                  defaultValue={profile?.availability ?? ""}
                  placeholder="T.ex. Mån–ons hela dagar, tors efter kl 13"
                />
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? "Sparar…" : "Spara profil"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6 shadow-soft">
          <CardHeader>
            <CardTitle>Utdrag ur belastningsregistret</CardTitle>
            <CardDescription>
              Ladda upp ditt utdrag som PDF eller bild. Endast du och REKO UF-teamet kan se filen.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm">
              Status:{" "}
              <strong>{BACKGROUND_LABELS[profile?.background_status ?? "pending"]}</strong>
              {profile?.background_file_path ? " · fil uppladdad" : " · ingen fil uppladdad"}
            </p>
            <div>
              <input
                id="bgfile"
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={handleUpload}
              />
              <Button asChild variant="outline" disabled={uploading}>
                <label htmlFor="bgfile" className="cursor-pointer">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Laddar upp…" : "Ladda upp fil"}
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>

        {!isAdmin && (
          <Card className="mt-6 border-dashed">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <p className="text-sm text-muted-foreground">
                Tillhör du REKO UF-teamet och är först i systemet? Gör dig till admin.
              </p>
              <Button variant="outline" size="sm" onClick={claimAdmin}>
                Bli plattformsadmin
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
