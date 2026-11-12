import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Booking commits its own outbox rows; browsers can never initiate delivery. */
export const notifyAssignmentClaimed = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ assignmentId: z.string().uuid() }).parse(value))
  .handler(async () => {
    throw new Error('Bokningsbesked hanteras automatiskt av utskickskön.');
  });

export const getEmailOutbox = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ offset: z.number().int().min(0).default(0) }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc('admin_email_outbox' as never, { p_offset: data.offset } as never);
    if (error) throw new Error('Kunde inte läsa utskickskön');
    return (rows ?? []) as unknown as EmailOutboxRow[];
  });

export type EmailOutboxRow = {
  id: string; assignment_id: string; template: string; recipient_kind: string;
  status: string; attempts: number; last_error: string | null; created_at: string;
  available_at: string; test_snapshot: boolean;
};

export const retryEmailOutbox = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ id: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('admin_retry_email' as never, { p_id: data.id } as never);
    if (error) throw new Error('Kunde inte köa ett nytt försök');
    return { ok: true };
  });

export const dispatchQueuedEmails = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc('is_admin');
    if (error || isAdmin !== true) throw new Error('Endast admin');
    const { dispatchEmailOutbox } = await import('./outbox.server');
    return dispatchEmailOutbox(10);
  });
