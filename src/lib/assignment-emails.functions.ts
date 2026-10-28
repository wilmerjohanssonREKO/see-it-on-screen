import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import { isSandbox } from "@/lib/sandbox";

/**
 * Sends the two match emails after a substitute claims an assignment:
 * one to the substitute, one to the school. Called from the browser right
 * after a successful claim_assignment RPC. The caller must be the assigned
 * substitute — verified server-side before anything is sent. Email failures
 * never fail the claim itself.
 */
export const notifyAssignmentClaimed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ assignmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: assignment } = await supabase
      .from("assignments")
      .select("id, school_id, subject, assignment_date, start_time, end_time, assigned_substitute_id")
      .eq("id", data.assignmentId)
      .maybeSingle();

    if (!assignment || assignment.assigned_substitute_id !== userId) {
      throw new Error("Uppdraget hittades inte");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: substitute }, { data: school }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name, email, is_test").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("schools").select("name, email, is_test").eq("id", assignment.school_id).maybeSingle(),
    ]);

    const details = {
      schoolName: school?.name ?? undefined,
      subject: assignment.subject ?? undefined,
      date: assignment.assignment_date ?? undefined,
      startTime: assignment.start_time?.slice(0, 5) ?? undefined,
      endTime: assignment.end_time?.slice(0, 5) ?? undefined,
    };

    type SendOutcome = { sent: boolean; reason?: string };
    const results: { substitute?: SendOutcome; school?: SendOutcome } = {};

    // Sandlådeläge: test-data never leaves the system — capture to the test inbox instead.
    if (isSandbox(substitute?.is_test, school?.is_test)) {
      const rows = [
        substitute?.email && {
          template: "uppdrag-tilldelat",
          recipient: substitute.email,
          assignment_id: assignment.id,
          data: { name: substitute.full_name, ...details },
        },
        school?.email && {
          template: "vikarie-tilldelad",
          recipient: school.email,
          assignment_id: assignment.id,
          data: { substituteName: substitute?.full_name, ...details },
        },
      ].filter(Boolean) as { template: string; recipient: string; assignment_id: string; data: Record<string, unknown> }[];
      if (rows.length) await supabaseAdmin.from("sandbox_emails").insert(rows as never);
      return { substitute: { sent: false, reason: "sandbox" }, school: { sent: false, reason: "sandbox" } };
    }


    if (substitute?.email) {
      try {
        results.substitute = await sendTemplateEmail("uppdrag-tilldelat", substitute.email, {
          templateData: { name: substitute.full_name ?? undefined, ...details },
          idempotencyKey: `uppdrag-tilldelat-${assignment.id}`,
        });
      } catch (error) {
        console.error("Kunde inte skicka mejl till vikarie:", error);
        results.substitute = { sent: false, reason: "send_failed" };
      }
    }

    if (school?.email) {
      try {
        results.school = await sendTemplateEmail("vikarie-tilldelad", school.email, {
          templateData: { substituteName: substitute?.full_name ?? undefined, ...details },
          idempotencyKey: `vikarie-tilldelad-${assignment.id}`,
        });
      } catch (error) {
        console.error("Kunde inte skicka mejl till skola:", error);
        results.school = { sent: false, reason: "send_failed" };
      }
    }

    return results;
  });
