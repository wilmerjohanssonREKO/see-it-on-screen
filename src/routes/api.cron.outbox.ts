import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

export const Route = createFileRoute('/api/cron/outbox')({
  server: { handlers: { POST: async ({ request }) => {
    const denied = await authenticateCronRequest(request);
    if (denied) return denied;
    try {
      const { dispatchEmailOutbox } = await import('@/lib/outbox.server');
      return Response.json(await dispatchEmailOutbox(10), { headers: { 'cache-control': 'no-store' } });
    } catch {
      return Response.json({ error: 'Utskicksjobbet kunde inte slutföras' }, { status: 503 });
    }
  } } },
});
