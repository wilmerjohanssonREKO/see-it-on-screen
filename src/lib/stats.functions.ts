import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { pagedCsv } from "./csv-pages";

export type AssignmentMetric = {
  assignment_id: string;
  subject: string;
  school_name: string;
  school_id: string;
  created_at: string;
  published_at: string;
  starts_at: string;
  notified_count: number;
  viewed_count: number;
  accepted_count: number;
  minutes_to_first_response: number | null;
  minutes_to_filled: number | null;
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

type PagingArgs = { p_limit: number; p_offset: number };
type ExportArgs = {
  p_before: string;
  p_cursor_at: string | null;
  p_cursor_id: string | null;
  p_limit: number;
};
type PagedRpc = {
  (
    name: "admin_assignment_metrics_page",
    args: PagingArgs,
  ): PromiseLike<{ data: AssignmentMetric[] | null; error: unknown }>;
  (
    name: "admin_assignment_metrics_export_page",
    args: ExportArgs,
  ): PromiseLike<{ data: AssignmentMetric[] | null; error: unknown }>;
  (
    name: "admin_event_log_export_page",
    args: ExportArgs,
  ): PromiseLike<{ data: EventLogRow[] | null; error: unknown }>;
};
const paging = z
  .object({
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(100).default(100),
  })
  .default({ offset: 0, limit: 100 });

export const getAssignmentMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => paging.parse(input))
  .handler(async ({ data: page, context }): Promise<AssignmentMetric[]> => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as PagedRpc;
    const { data, error } = await rpc("admin_assignment_metrics_page", {
      p_limit: page.limit,
      p_offset: page.offset,
    });
    if (error) throw new Error("Kunde inte hämta statistiken");
    return (data ?? []) as AssignmentMetric[];
  });

export const exportMetricsCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string> => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as PagedRpc;
    const before = new Date().toISOString();
    return pagedCsv<AssignmentMetric>(
      [
        "uppdrag_id",
        "amne",
        "skola",
        "skapad",
        "publicerad",
        "startar",
        "notifierade",
        "oppnat",
        "tackat_ja",
        "minuter_till_forsta_svar",
        "minuter_till_tillsatt",
        "utfall",
        "betyg",
      ],
      async (cursor) => {
        const { data, error } = await rpc("admin_assignment_metrics_export_page", {
          p_before: before,
          p_cursor_at: cursor?.at ?? null,
          p_cursor_id: cursor?.id ?? null,
          p_limit: 500,
        });
        if (error) throw new Error("Kunde inte hämta statistiken");
        return data ?? [];
      },
      (m) => ({ at: m.created_at, id: m.assignment_id }),
      (m) => [
        m.assignment_id,
        m.subject,
        m.school_name,
        m.created_at,
        m.published_at,
        m.starts_at,
        m.notified_count,
        m.viewed_count,
        m.accepted_count,
        m.minutes_to_first_response,
        m.minutes_to_filled,
        m.outcome,
        m.rating,
      ],
    );
  });

export const exportEventLogCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string> => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as PagedRpc;
    const before = new Date().toISOString();
    return pagedCsv<EventLogRow>(
      ["id", "tidpunkt", "handelse", "uppdrag_id", "skol_id", "vikarie_pseudonym", "metadata"],
      async (cursor) => {
        const { data, error } = await rpc("admin_event_log_export_page", {
          p_before: before,
          p_cursor_at: cursor?.at ?? null,
          p_cursor_id: cursor?.id ?? null,
          p_limit: 500,
        });
        if (error) throw new Error("Kunde inte hämta loggen");
        return data ?? [];
      },
      (e) => ({ at: e.occurred_at, id: e.id }),
      (e) => [
        e.id,
        e.occurred_at,
        e.event_type,
        e.assignment_id,
        e.school_id,
        e.substitute_ref,
        e.metadata,
      ],
    );
  });

export const purgeOldLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    const { data, error } = await context.supabase.rpc("purge_old_event_log");
    if (error) throw new Error("Kunde inte radera gammal loggdata");
    return (data as number) ?? 0;
  });
