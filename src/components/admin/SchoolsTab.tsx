import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { InvitationForm } from "@/components/admin/InvitationForm";
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
  const { user } = useAuth();
  const saveContact = useServerFn(saveSchoolContact);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["schools", user?.id],
    enabled: !!user,
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
    if (!window.confirm("Radera skolan? Skolor med uppdragshistorik kan inte raderas eftersom historiken ska bevaras.")) return;
    const { error } = await supabase.from("schools").delete().eq("id", id);
    if (error) toast.error("Skolan kunde inte raderas. Befintlig uppdragshistorik måste bevaras.");
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
              <InvitationForm schoolId={s.id} defaultEmail={s.email ?? ""} memberType="school" />
              <InvitationForm schoolId={s.id} memberType="teacher" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
