import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { bookingRpc } from "@/lib/booking";
import { getCvSignedUrl } from "@/lib/cv.functions";
import { Button } from "@/components/ui/button";
import { SubstituteAvatar } from "@/components/SubstituteAvatar";
import { RatingSummary } from "@/components/StarRating";
import { QueryError } from "./QueryState";

type Applicant = {
  substitute_id: string; full_name: string | null; phone: string | null; subjects: string[] | null;
  has_cv: boolean; status: string; created_at: string; rating_avg: number | null; rating_count: number;
};

export function AssignmentApplicants({ assignmentId, schoolId, userId, count }: { assignmentId: string; schoolId: string; userId: string; count: number }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const getCv = useServerFn(getCvSignedUrl);
  const key = ["school-applicants", userId, schoolId, assignmentId];
  const applicants = useQuery({
    queryKey: key, enabled: open,
    queryFn: () => bookingRpc<Applicant[]>("school_applicants", { p_assignment_id: assignmentId }),
    refetchInterval: open ? 15_000 : false,
  });
  const decision = useMutation({
    mutationFn: ({ id, select }: { id: string; select: boolean }) => bookingRpc<string | boolean>(select ? "select_applicant" : "reject_applicant", { p_assignment_id: assignmentId, p_substitute_id: id }),
    onSuccess: (result, action) => {
      if (action.select && result !== "selected") {
        toast.error(result === "overlap" ? "Vikarien har redan ett annat uppdrag under den tiden." : result === "not_approved" ? "Vikarien är inte längre godkänd." : "Uppdraget eller intresseanmälan är inte längre tillgängligt.");
      } else if (!action.select && result !== true) toast.error("Intresseanmälan kan redan ha ändrats. Hämta aktuell status.");
      else toast.success(action.select ? "Vikarien är vald. Bekräftelser köas för utskick." : "Intresseanmälan är avböjd.");
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["school-assignments"] });
    },
    onError: (error) => toast.error(error.message || "Kunde inte uppdatera intresseanmälan"),
  });
  async function readCv(id: string) {
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const { url } = await getCv({ data: { substituteId: id } });
      if (!url) throw new Error("CV saknas");
      if (tab) tab.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch { tab?.close(); toast.error("Kunde inte öppna CV:t. Kontrollera att vikarien fortfarande söker uppdraget."); }
  }
  return <div className="grid gap-3 border-t border-border pt-3">
    <Button type="button" variant="outline" className="min-h-11 justify-self-start" onClick={() => setOpen(!open)} aria-expanded={open}>
      {open ? "Dölj intresseanmälningar" : `Visa intresseanmälningar (${count})`}
    </Button>
    {open && <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Granska profilerna och välj den vikarie som passar uppdraget. Uppdraget tillsätts först när ni har valt.</p>
      {applicants.isPending && <p role="status" className="text-sm">Hämtar intresseanmälningar…</p>}
      {applicants.isError && <QueryError retry={() => { void applicants.refetch(); }} message="Kunde inte hämta intresseanmälningarna." />}
      {!applicants.isPending && !applicants.isError && !applicants.data?.some((a) => a.status === "pending") && <p className="text-sm text-muted-foreground">Inga aktuella intresseanmälningar ännu.</p>}
      {applicants.data?.filter((a) => a.status === "pending").map((a) => <div key={a.substitute_id} className="grid gap-3 rounded-panel border border-border p-4">
        <div className="flex items-center gap-3"><SubstituteAvatar id={a.substitute_id} name={a.full_name} /><div><p className="font-semibold">{a.full_name || "Vikarie"}</p><RatingSummary avg={a.rating_avg} count={a.rating_count} /></div></div>
        {a.subjects?.length ? <p className="text-sm text-muted-foreground">Ämnen: {a.subjects.join(", ")}</p> : null}
        <div className="flex flex-wrap gap-2">
          {a.has_cv && <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => readCv(a.substitute_id)}><FileText className="h-4 w-4" /> Läs CV</Button>}
          <Button type="button" size="sm" className="min-h-11" disabled={decision.isPending} onClick={() => { if (window.confirm(`Välj ${a.full_name || "den här vikarien"} till uppdraget?`)) decision.mutate({ id: a.substitute_id, select: true }); }}>Välj vikarie</Button>
          <Button type="button" size="sm" variant="ghost" className="min-h-11" disabled={decision.isPending} onClick={() => { if (window.confirm("Avböj den här intresseanmälan?")) decision.mutate({ id: a.substitute_id, select: false }); }}>Avböj</Button>
        </div>
      </div>)}
    </div>}
  </div>;
}
