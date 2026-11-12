import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bookingRpc } from "@/lib/booking";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QueryError } from "./QueryState";

type Request = {
  id: string; assignment_id: string; school_name: string; subject: string; assignment_date: string;
  requester_name: string | null; requester_kind: string; reason: string; status: string; created_at: string;
};
const LABELS: Record<string, string> = { pending: "Väntar på beslut", approved: "Godkänd", denied: "Avslagen" };
const PAGE_SIZE = 25;
export function AdminCancellations() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const qc = useQueryClient();
  const requests = useQuery({
    queryKey: ["admin-cancellations", user?.id, page], enabled: !!user?.id,
    queryFn: () => bookingRpc<Request[]>("admin_cancellation_requests", { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
    refetchInterval: 15_000,
  });
  const resolve = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => bookingRpc<boolean>("admin_resolve_cancellation", { p_request_id: id, p_approve: approve }),
    onSuccess: (changed) => {
      if (!changed) { toast.error("Begäran har redan behandlats eller kan inte ändras. Hämta aktuell status."); void requests.refetch(); return; }
      toast.success("Beslutet är sparat. Berörda parter får en bekräftelse.");
      for (const key of ["admin-cancellations", "assignments", "school-assignments", "my-assignments"]) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (error) => toast.error(error.message || "Kunde inte spara beslutet"),
  });
  return <Card>
    <CardHeader><CardTitle>Avbokningsbegäran</CardTitle></CardHeader>
    <CardContent className="grid gap-3">
      {requests.isPending && <p role="status" className="text-sm">Hämtar avbokningsbegäran…</p>}
      {requests.isError && <QueryError retry={() => { void requests.refetch(); }} message="Kunde inte hämta avbokningsbegäran." />}
      {!requests.isPending && !requests.isError && !requests.data?.length && <p className="text-sm text-muted-foreground">Inga avbokningsbegäran.</p>}
      {requests.data?.map((request) => <div key={request.id} className="grid gap-2 rounded-panel border border-border p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{request.subject} · {request.school_name} · {request.assignment_date}</p><Badge variant={request.status === "pending" ? "default" : "secondary"}>{LABELS[request.status] ?? request.status}</Badge></div>
        <p className="text-muted-foreground">Begärd av {request.requester_name || (request.requester_kind === "school" ? "skolan" : "vikarien")}.</p>
        <p className="whitespace-pre-wrap break-words">{request.reason}</p>
        {request.status === "pending" && <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="min-h-11" disabled={resolve.isPending} onClick={() => {
            const effect = request.requester_kind === "school" ? "Skolans uppdrag avslutas." : "Vikarien tas bort och det framtida uppdraget öppnas för nya intresseanmälningar.";
            if (window.confirm(`Godkänn avbokningen? ${effect}`)) resolve.mutate({ id: request.id, approve: true });
          }}>Godkänn avbokning</Button>
          <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={resolve.isPending} onClick={() => { if (window.confirm("Avslå begäran? Bokningen fortsätter att gälla.")) resolve.mutate({ id: request.id, approve: false }); }}>Avslå begäran</Button>
        </div>}
      </div>)}
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" disabled={!page || requests.isFetching} onClick={() => setPage((p) => p - 1)}>Föregående</Button>
        <span className="text-sm text-muted-foreground">Sida {page + 1}</span>
        <Button type="button" variant="outline" disabled={requests.isFetching || !requests.data || requests.data.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Nästa</Button>
      </div>
    </CardContent>
  </Card>;
}
