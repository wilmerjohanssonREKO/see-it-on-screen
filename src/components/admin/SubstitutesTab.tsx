import { useServerFn } from "@tanstack/react-start";
import { deleteUserCompletely } from "@/lib/user-admin.functions";
import { getCvSignedUrl } from "@/lib/cv.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubstituteAvatar } from "@/components/SubstituteAvatar";
import { BACKGROUND_LABELS } from "@/lib/subjects";

export function SubstitutesTab() {
  const deleteUser = useServerFn(deleteUserCompletely);
  const getCvUrl = useServerFn(getCvSignedUrl);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["substitutes"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: members }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("school_members").select("user_id"),
      ]);
      if (error) throw error;
      const schoolUsers = new Set((members ?? []).map((m) => m.user_id));
      return (profiles ?? []).filter((p) => !schoolUsers.has(p.id));
    },
  });

  async function update(id: string, patch: TablesUpdate<"profiles">) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) toast.error("Kunde inte uppdatera");
    else {
      toast.success("Uppdaterat");
      qc.invalidateQueries({ queryKey: ["substitutes"] });
    }
  }

  async function deleteSubstitute(id: string) {
    if (!window.confirm("Ta bort vikarien helt, inklusive inlogg? Det går inte att ångra.")) return;
    try {
      await deleteUser({ data: { userId: id } });
      toast.success("Vikarie borttagen");
      qc.invalidateQueries({ queryKey: ["substitutes"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte ta bort vikarien");
    }
  }

  async function openCv(substituteId: string) {
    try {
      const { url } = await getCvUrl({ data: { substituteId } });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte öppna CV:t");
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      {data?.map((p) => (
        <Card key={p.id}>
          <CardContent className="grid gap-2 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <SubstituteAvatar id={p.id} name={p.full_name} />
                <div>
                  <p className="font-semibold">{p.full_name || p.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.email} {p.phone ? `· ${p.phone}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={p.approved ? "default" : "secondary"}>
                  {p.approved ? "Godkänd" : "Ej godkänd"}
                </Badge>
                <Badge variant="outline">{BACKGROUND_LABELS[p.background_status]}</Badge>
                <Badge variant="outline">{p.cv_file_path ? "CV uppladdat" : "Inget CV"}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {p.school_name ?? "—"} {p.graduation_year ? `· examen ${p.graduation_year}` : ""}
            </p>
            <p className="text-sm">Ämnen: {p.subjects.join(", ") || "inga valda"}</p>
            {p.availability && (
              <p className="text-sm text-muted-foreground">Tillgänglighet: {p.availability}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={
                  !p.approved && (p.background_status !== "approved" || !p.phone || !p.full_name)
                }
                title={
                  p.background_status !== "approved"
                    ? "Kontrollera utdraget och sätt status till Godkänd först"
                    : undefined
                }
                onClick={() => update(p.id, { approved: !p.approved })}
              >
                {p.approved
                  ? "Ta bort godkännande"
                  : p.background_status === "approved"
                    ? "Godkänn vikarie"
                    : "Utdrag ej kontrollerat"}
              </Button>
              <Select
                value={p.background_status}
                onValueChange={(v) =>
                  update(p.id, { background_status: v as "pending" | "approved" | "needs_renewal" })
                }
              >
                <SelectTrigger className="h-8 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Väntar granskning</SelectItem>
                  <SelectItem value="approved">Utdrag kontrollerat</SelectItem>
                  <SelectItem value="needs_renewal">Behöver förnyas</SelectItem>
                </SelectContent>
              </Select>
              {p.cv_file_path && (
                <Button size="sm" variant="ghost" onClick={() => openCv(p.id)}>
                  <FileText className="h-4 w-4" /> Visa CV
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => deleteSubstitute(p.id)}>
                <Trash2 className="h-4 w-4" /> Radera
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Betyg ---------------- */
