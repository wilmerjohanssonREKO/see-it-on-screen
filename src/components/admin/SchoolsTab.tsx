import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createSchoolLogin } from "@/lib/school-admin.functions";
import { generateSchoolCode } from "@/lib/teacher.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AddressFields } from "@/components/AddressFields";
import { schoolContactSchema } from "@/lib/contact-schemas";
import { saveSchoolContact } from "@/lib/contact.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SchoolsTab() {
  const saveContact = useServerFn(saveSchoolContact);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const editing = data?.find((school) => school.id === editingId);
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = schoolContactSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Kontrollera uppgifterna");
      return;
    }
    setSaving(true);
    try {
      await saveContact({ data: { ...parsed.data, id: editingId ?? undefined } });
      toast.success(editingId ? "Skoluppgifterna är uppdaterade" : "Skola tillagd");
      form.reset();
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["schools"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara skolan");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSchool(id: string) {
    const { error } = await supabase.from("schools").delete().eq("id", id);
    if (error) toast.error("Kunde inte ta bort skolan");
    else {
      toast.success("Skola borttagen");
      qc.invalidateQueries({ queryKey: ["schools"] });
    }
  }

  return (
    <div className="mt-4 grid gap-6">
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>{editingId ? "Ändra skoluppgifter" : "Lägg till skola"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form key={editingId ?? "new"} className="grid gap-4 sm:grid-cols-2" onSubmit={add}>
            <div className="grid gap-2">
              <Label htmlFor="name">Namn</Label>
              <Input
                id="name"
                name="name"
                defaultValue={editing?.name ?? ""}
                maxLength={120}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_person">Kontaktperson</Label>
              <Input
                id="contact_person"
                name="contact_person"
                defaultValue={editing?.contact_person ?? ""}
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
                defaultValue={editing?.email ?? ""}
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
                defaultValue={editing?.phone ?? ""}
                minLength={5}
                maxLength={40}
                required
                pattern="[+0-9 ()-]+"
              />
            </div>
            <AddressFields values={editing} prefix="school-address" />
            <Button type="submit" className="sm:col-span-2" disabled={saving}>
              {saving ? "Sparar…" : "Spara skola"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                Avbryt
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {data?.map((s) => (
          <Card key={s.id}>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.contact_person ?? "—"} {s.email ? `· ${s.email}` : ""}{" "}
                    {s.phone ? `· ${s.phone}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="destructive" onClick={() => deleteSchool(s.id)}>
                  <Trash2 className="h-4 w-4" /> Radera
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {s.street_address
                  ? `${s.street_address}, ${s.postal_code ?? ""} ${s.city ?? ""}`
                  : "Adress saknas"}
              </p>
              <Button
                className="mt-3"
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingId(s.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Ändra uppgifter
              </Button>
              <SchoolLoginForm schoolId={s.id} defaultEmail={s.email ?? ""} />
              <SchoolCodeButton schoolId={s.id} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Feedback ---------------- */

function SchoolLoginForm({ schoolId, defaultEmail }: { schoolId: string; defaultEmail: string }) {
  const create = useServerFn(createSchoolLogin);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    try {
      await create({
        data: {
          schoolId,
          email: String(fd.get("email") ?? ""),
          password: String(fd.get("password") ?? ""),
        },
      });
      toast.success("Inlogg skapat! Skicka uppgifterna till skolan.");
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte skapa inlogg");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_auto]"
    >
      <Input
        name="email"
        type="email"
        placeholder="Skolans inlogg (e-post)"
        defaultValue={defaultEmail}
        required
        maxLength={255}
      />
      <Input
        name="password"
        type="text"
        placeholder="Lösenord (minst 8 tecken)"
        required
        minLength={8}
        maxLength={72}
      />
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Skapar…" : "Skapa skolinlogg"}
      </Button>
    </form>
  );
}

function SchoolCodeButton({ schoolId }: { schoolId: string }) {
  const gen = useServerFn(generateSchoolCode);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    if (
      !window.confirm(
        "Generera ny skolkod? Den gamla koden slutar fungera för nya lärare (redan registrerade lärare behåller åtkomst).",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await gen({ data: { schoolId } });
      setCode(res.code);
    } catch {
      toast.error("Kunde inte generera kod");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <Button type="button" size="sm" variant="outline" onClick={run} disabled={busy}>
        {busy ? "Genererar…" : "Generera ny kod"}
      </Button>
      {code ? (
        <span className="text-sm">
          Skolkod:{" "}
          <code className="rounded bg-secondary px-2 py-1 font-mono font-semibold">{code}</code>{" "}
          <span className="text-muted-foreground">— visas bara nu, ge den till skolan.</span>
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">
          Lärare använder skolkoden för att skapa konto.
        </span>
      )}
    </div>
  );
}
