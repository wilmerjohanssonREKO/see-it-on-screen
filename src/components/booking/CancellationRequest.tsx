import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bookingRpc, CANCELLATION_LABELS } from "@/lib/booking";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CancellationRequest({ assignmentId, status, canRequest = true }: { assignmentId: string; status?: string | null; canRequest?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const request = useMutation({
    mutationFn: () => bookingRpc<string>("request_assignment_cancellation", {
      p_assignment_id: assignmentId, p_reason: reason.trim(),
    }),
    onSuccess: () => {
      toast.success("Begäran är skickad till REKO. Bokningen gäller tills REKO har fattat beslut.");
      setOpen(false);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["school-assignments"] });
      void qc.invalidateQueries({ queryKey: ["my-assignments"] });
      void qc.invalidateQueries({ queryKey: ["admin-cancellations"] });
    },
    onError: (error) => toast.error(error.message || "Kunde inte skicka begäran"),
  });
  return <div className="grid gap-2 text-sm">
    {status && <p role="status" className="text-muted-foreground">{CANCELLATION_LABELS[status] ?? status}</p>}
    {canRequest && status !== "pending" && !open && <Button type="button" size="sm" variant="outline" className="min-h-11 justify-self-start" onClick={() => setOpen(true)}>Begär avbokning</Button>}
    {canRequest && open && <form className="grid gap-3 rounded-panel border border-border p-3" onSubmit={(e) => { e.preventDefault(); request.mutate(); }}>
      <Label htmlFor={`cancel-${assignmentId}`}>Varför behöver uppdraget avbokas?</Label>
      <Textarea id={`cancel-${assignmentId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} required rows={3} />
      <p className="text-muted-foreground">REKO behandlar begäran. Uppdraget är fortfarande bokat tills ni får ett beslut.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={request.isPending || !reason.trim()} className="min-h-11">{request.isPending ? "Skickar…" : "Skicka begäran"}</Button>
        <Button type="button" variant="ghost" className="min-h-11" disabled={request.isPending} onClick={() => setOpen(false)}>Stäng</Button>
      </div>
    </form>}
  </div>;
}
