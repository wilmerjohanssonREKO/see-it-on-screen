import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { saveProfileContact } from "@/lib/contact.functions";
import { getCvSignedUrl } from "@/lib/cv.functions";
import { contactShape, substituteContactSchema } from "@/lib/contact-schemas";
import { z } from "zod";
import { AddressFields } from "@/components/AddressFields";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Trash2, Upload } from "lucide-react";

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
  const [cvConsent, setCvConsent] = useState(false);
  const [cvBusy, setCvBusy] = useState(false);
  const getCvUrl = useServerFn(getCvSignedUrl);

  useEffect(() => {
    if (profile?.subjects) setSubjects(profile.subjects);
  }, [profile?.subjects]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const year = String(fd.get("graduation_year") ?? "").trim();
    const raw = {
      full_name: String(fd.get("full_name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      street_address: String(fd.get("street_address") ?? ""),
      postal_code: String(fd.get("postal_code") ?? ""),
      city: String(fd.get("city") ?? ""),
      school_name: String(fd.get("school_name") ?? ""),
      graduation_year: year ? Number(year) : null,
      availability: String(fd.get("availability") ?? ""),
      subjects,
    };
    const parsed = schoolId
      ? z.object(contactShape).safeParse(raw)
      : substituteContactSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Kontrollera uppgifterna");
      return;
    }
    setSaving(true);
    try {
      const result = await saveContact({ data: parsed.data });
      toast.success("Profilen är sparad");
      if (result?.geoWarning)
        toast.warning("Kunde inte hitta positionen för postnumret — avståndsmatchning fungerar inte för din adress ännu");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara profilen");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("background-checks").upload(path, file);
    if (!error) {
      const { error: saveError } = await supabase
        .from("profiles")
        .update({ background_file_path: path })
        .eq("id", userId);
      if (saveError) toast.error("Filen laddades upp men kunde inte kopplas till profilen");
      else toast.success("Filen är uppladdad och väntar på granskning");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } else {
      toast.error("Uppladdningen misslyckades");
    }
    setUploading(false);
  }

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    if (file.type !== "application/pdf") {
      toast.error("Endast PDF-filer är tillåtna");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Filen får vara max 5 MB");
      return;
    }
    if (!profile?.cv_consent_at && !cvConsent) {
      toast.error("Du måste samtycka innan du laddar upp ditt CV");
      return;
    }
    setCvBusy(true);
    const path = `${userId}/${Date.now()}-cv.pdf`;
    const { error } = await supabase.storage.from("cvs").upload(path, file);
    if (error) {
      toast.error("Uppladdningen misslyckades");
      setCvBusy(false);
      return;
    }
    if (profile?.cv_file_path) {
      await supabase.storage.from("cvs").remove([profile.cv_file_path]);
    }
    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        cv_file_path: path,
        ...(profile?.cv_consent_at ? {} : { cv_consent_at: new Date().toISOString() }),
      })
      .eq("id", userId);
    if (saveError) toast.error("CV:t laddades upp men kunde inte kopplas till profilen");
    else toast.success("Ditt CV är uppladdat");
    qc.invalidateQueries({ queryKey: ["profile"] });
    setCvBusy(false);
  }

  async function handleCvRemove() {
    if (!userId || !profile?.cv_file_path) return;
    if (!window.confirm("Ta bort ditt CV?")) return;
    setCvBusy(true);
    await supabase.storage.from("cvs").remove([profile.cv_file_path]);
    const { error } = await supabase
      .from("profiles")
      .update({ cv_file_path: null, cv_consent_at: null })
      .eq("id", userId);
    if (error) toast.error("Kunde inte ta bort CV:t");
    else toast.success("CV:t är borttaget");
    setCvConsent(false);
    qc.invalidateQueries({ queryKey: ["profile"] });
    setCvBusy(false);
  }

  async function handleCvView() {
    if (!userId) return;
    try {
      const { url } = await getCvUrl({ data: { substituteId: userId } });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte öppna CV:t");
    }
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
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={profile?.phone ?? ""}
                    required
                    minLength={5}
                    maxLength={40}
                    pattern="[+0-9 ()-]+"
                  />
                </div>
                {!schoolId && <AddressFields values={profile ?? undefined} />}
                {!schoolId && (
                  <div className="grid gap-2">
                    <Label htmlFor="school_name">Skola du gick på</Label>
                    <Input
                      id="school_name"
                      name="school_name"
                      defaultValue={profile?.school_name ?? ""}
                      maxLength={120}
                    />
                  </div>
                )}
                {!schoolId && (
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
                )}
              </div>

              {!schoolId && (
                <div className="grid gap-2">
                  <Label>Ämnen du kan vikariera i</Label>
                  <div className="grid gap-2 rounded-lg border border-border p-4 sm:grid-cols-2">
                    {SUBJECTS.map((s) => (
                      <label key={s} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={subjects.includes(s)}
                          onCheckedChange={(v) =>
                            setSubjects((prev) => (v ? [...prev, s] : prev.filter((x) => x !== s)))
                          }
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!schoolId && (
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
              )}

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
              Vi sparar inte ditt utdrag. Visa upp originalet (det oöppnade kuvertet eller
              den digitala versionen) för REKO UF-teamet — vi noterar bara att det är kontrollerat
              och datumet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Status: <strong>{BACKGROUND_LABELS[profile?.background_status ?? "pending"]}</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6 shadow-soft">
          <CardHeader>
            <CardTitle>Mitt CV</CardTitle>
            <CardDescription>
              Ladda upp ditt CV som PDF (max 5 MB). Endast du, REKO UF-teamet och skolor du
              anmält dig till kan läsa det.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm">
              {profile?.cv_file_path ? (
                <>
                  <strong>CV uppladdat</strong>
                  {profile.cv_consent_at ? " · samtycke givet" : ""}
                </>
              ) : (
                "Inget CV uppladdat"
              )}
            </p>
            {!profile?.cv_consent_at && (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={cvConsent}
                  onCheckedChange={(v) => setCvConsent(v === true)}
                />
                Jag samtycker till att skolor jag anmäler mig till kan läsa mitt CV.
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                id="cvfile"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleCvUpload}
              />
              <Button
                asChild
                variant="outline"
                disabled={cvBusy || (!profile?.cv_consent_at && !cvConsent)}
              >
                <label htmlFor="cvfile" className="cursor-pointer">
                  <Upload className="h-4 w-4" />
                  {cvBusy
                    ? "Laddar upp…"
                    : profile?.cv_file_path
                      ? "Ersätt CV"
                      : "Ladda upp CV"}
                </label>
              </Button>
              {profile?.cv_file_path && (
                <>
                  <Button size="default" variant="ghost" onClick={handleCvView}>
                    <FileText className="h-4 w-4" /> Visa mitt CV
                  </Button>
                  <Button variant="ghost" onClick={handleCvRemove} disabled={cvBusy}>
                    <Trash2 className="h-4 w-4" /> Ta bort
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
