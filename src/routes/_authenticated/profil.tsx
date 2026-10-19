import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { saveProfileContact } from "@/lib/contact.functions";
import { contactShape, substituteContactSchema } from "@/lib/contact-schemas";
import { z } from "zod";
import { AddressFields } from "@/components/AddressFields";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useAuth, useProfile, useMySchoolId } from "@/hooks/useAuth";
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
  const qc = useQueryClient();
  const saveContact = useServerFn(saveProfileContact);
  const { data: schoolId, isLoading: schoolLoading } = useMySchoolId(userId);

  const [subjects, setSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile?.subjects) setSubjects(profile.subjects);
  }, [profile?.subjects]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const year = String(fd.get("graduation_year") ?? "").trim();
    const raw = {
      full_name: String(fd.get("full_name") ?? ""), email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""), street_address: String(fd.get("street_address") ?? ""),
      postal_code: String(fd.get("postal_code") ?? ""), city: String(fd.get("city") ?? ""),
      school_name: String(fd.get("school_name") ?? ""), graduation_year: year ? Number(year) : null,
      availability: String(fd.get("availability") ?? ""), subjects,
    };
    const parsed = schoolId ? z.object(contactShape).safeParse(raw) : substituteContactSchema.safeParse(raw);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Kontrollera uppgifterna"); return; }
    setSaving(true);
    try {
      await saveContact({ data: parsed.data });
      toast.success("Profilen är sparad");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara profilen");
    } finally { setSaving(false); }
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

  if (isLoading || schoolLoading) {
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
                  <Input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ""} required minLength={5} maxLength={40} pattern="[+0-9 ()-]+" />
                </div>
                {!schoolId && <AddressFields values={profile ?? undefined} />}
                {!schoolId && <div className="grid gap-2">
                  <Label htmlFor="school_name">Skola du gick på</Label>
                  <Input
                    id="school_name"
                    name="school_name"
                    defaultValue={profile?.school_name ?? ""}
                    maxLength={120}
                  />
                </div>}
                {!schoolId && <div className="grid gap-2">
                  <Label htmlFor="graduation_year">Examensår</Label>
                  <Input
                    id="graduation_year"
                    name="graduation_year"
                    type="number"
                    min={1970}
                    max={2100}
                    defaultValue={profile?.graduation_year ?? ""}
                  />
                </div>}
              </div>

              {!schoolId && <div className="grid gap-2">
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
              </div>}

              {!schoolId && <div className="grid gap-2">
                <Label htmlFor="availability">Tillgänglighet</Label>
                <Textarea
                  id="availability"
                  name="availability"
                  rows={3}
                  maxLength={1000}
                  defaultValue={profile?.availability ?? ""}
                  placeholder="T.ex. Mån–ons hela dagar, tors efter kl 13"
                />
              </div>}

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

      </main>
    </div>
  );
}
