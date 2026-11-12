import { supabase } from "@/integrations/supabase/client";

export type ApplicationStatus = "pending" | "selected" | "rejected" | "withdrawn";
export type CancellationStatus = "pending" | "approved" | "denied";

// Kept narrowly typed here until the generated Supabase schema is refreshed.
// Authorization and all transitions are enforced again by the database RPCs.
export async function bookingRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: T | null; error: { message: string } | null }>;
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function hasAssignmentStarted(date: string, time: string): boolean {
  const now = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(new Date());
  return `${date} ${time.padEnd(8, ":00")}` <= now;
}

export const APPLICATION_LABELS: Record<string, string> = {
  pending: "Intresse anmält – inväntar skolans val",
  selected: "Du är vald till uppdraget",
  rejected: "Skolan har valt en annan vikarie",
  withdrawn: "Intresseanmälan återkallad",
};

export const CANCELLATION_LABELS: Record<string, string> = {
  pending: "Avbokning begärd – REKO behandlar ärendet. Bokningen gäller tills vidare.",
  approved: "Avbokningen är godkänd av REKO.",
  denied: "Avbokningen avslogs av REKO. Bokningen gäller fortfarande.",
};
