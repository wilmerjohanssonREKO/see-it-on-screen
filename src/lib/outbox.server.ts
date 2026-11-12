import { supabaseAdmin } from '@/integrations/supabase/client.server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTemplateEmail } from './email-templates/send-email';
import { deliveryDisposition, type OutboxJob } from './outbox';

// Schema changes ship before the generated Database declarations are refreshed.
const db = supabaseAdmin as SupabaseClient;

export async function dispatchEmailOutbox(limit = 10) {
  const { data, error } = await db.rpc('claim_email_outbox', { p_limit: Math.min(20, Math.max(1, limit)) });
  if (error) throw new Error('Kunde inte hämta utskickskön');
  const result = { processed: 0, sent: 0, captured: 0, suppressed: 0, cancelled: 0, retry: 0 };
  for (const job of (data ?? []) as OutboxJob[]) {
    let status: 'sent' | 'captured' | 'suppressed' | 'cancelled' | 'retry' = 'retry';
    let reason: string | null = null;
    try {
      const [schoolResult, profileResult, assignmentResult] = await Promise.all([
        db.from('schools').select('email,is_test').eq('id', job.school_id).maybeSingle(),
        job.substitute_id
          ? db.from('profiles').select('email,is_test').eq('id', job.substitute_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        db.from('assignments').select('notification_version,assigned_substitute_id,status').eq('id', job.assignment_id).maybeSingle(),
      ]);
      if (schoolResult.error || profileResult.error || assignmentResult.error) throw new Error('recipient_check_failed');
      const disposition = deliveryDisposition(job, schoolResult.data, profileResult.data, assignmentResult.data);
      if (disposition === 'capture') {
        const capture = await db.rpc('capture_email_outbox', { p_id: job.id, p_lock: job.lock_token });
        if (capture.error || capture.data !== true) throw new Error('capture_failed');
        result.processed++; result.captured++;
        continue;
      }
      if (disposition !== 'send') {
        status = 'cancelled'; reason = disposition;
      } else {
        const outcome = await sendTemplateEmail(job.template, job.recipient, {
          templateData: job.payload,
          idempotencyKey: `reko-outbox-${job.id}`,
        });
        status = outcome.sent ? 'sent' : 'suppressed';
        if (!outcome.sent) reason = outcome.reason;
      }
    } catch {
      // Provider exceptions can contain recipient data; persist only a fixed diagnostic code.
      status = 'retry'; reason = 'delivery_failed';
    }
    const completed = await db.rpc('finish_email_outbox', {
      p_id: job.id, p_lock: job.lock_token, p_status: status, p_error: reason,
    });
    if (completed.error || completed.data !== true) throw new Error('Kunde inte spara utskicksstatus');
    result.processed++; result[status]++;
  }
  return result;
}
