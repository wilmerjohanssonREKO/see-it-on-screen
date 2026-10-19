import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AssignmentMetric = {
  assignment_id: string;
  subject: string;
  school_name: string;
  school_id: string;
  created_at: string;
  published_at: string;
  starts_at: string;
  short_notice: boolean;
  notified_count: number;
  viewed_count: number;
  accepted_count: number;
  minutes_to_first_response: number | null;
  minutes_to_filled: number | null;
  filled_distance_km: number | null;
  avg_notified_distance_km: number | null;
  outcome: string;
  rating: number | null;
};

type EventLogRow = {
  id: string;
  occurred_at: string;
  event_type: string;
  assignment_id: string | null;
  school_id: string | null;
  substitute_ref: string | null;
  metadata: Record<string, unknown>;
};

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(";")];
  for (const row of rows) lines.push(row.map(csvCell).join(";"));
  return lines.join("\n");
}

export const getAssignmentMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AssignmentMetric[]> => {
    const { data, error } = await context.supabase.rpc("admin_assignment_metrics");
    if (error) throw new Error("Kunde inte hämta statistiken");
    return (data ?? []) as AssignmentMetric[];
  });

export const exportMetricsCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string> => {
    const { data, error } = await context.supabase.rpc("admin_assignment_metrics");
    if (error) throw new Error("Kunde inte hämta statistiken");
    const rows = ((data ?? []) as AssignmentMetric[]).map((m) => [
      m.assignment_id,
      m.subject,
      m.school_name,
      m.created_at,
      m.published_at,
      m.starts_at,
      m.short_notice ? "ja" : "nej",
      m.notified_count,
      m.viewed_count,
      m.accepted_count,
      m.minutes_to_first_response,
      m.minutes_to_filled,
      m.filled_distance_km,
      m.avg_notified_distance_km,
      m.outcome,
      m.rating,
    ]);
    return toCsv(
      [
        "uppdrag_id", "amne", "skola", "skapad", "publicerad", "startar",
        "kort_varsel", "notifierade", "oppnat", "tackat_ja",
        "minuter_till_forsta_svar", "minuter_till_tillsatt",
        "avstand_tillsatt_km", "snittavstand_notifierade_km", "utfall", "betyg",
      ],
      rows,
    );
  });

export const exportEventLogCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string> => {
    const { data, error } = await context.supabase.rpc("admin_event_log");
    if (error) throw new Error("Kunde inte hämta loggen");
    const rows = ((data ?? []) as EventLogRow[]).map((e) => [
      e.id,
      e.occurred_at,
      e.event_type,
      e.assignment_id,
      e.school_id,
      e.substitute_ref,
      e.metadata,
    ]);
    return toCsv(
      ["id", "tidpunkt", "handelse", "uppdrag_id", "skol_id", "vikarie_pseudonym", "metadata"],
      rows,
    );
  });

export const purgeOldLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    const { data, error } = await context.supabase.rpc("purge_old_event_log");
    if (error) throw new Error("Kunde inte radera gammal loggdata");
    return (data as number) ?? 0;
  });
