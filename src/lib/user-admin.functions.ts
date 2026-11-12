import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Repeat calls resume the same deletion job; completed assignments never reopen. */
export const deleteUserCompletely = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ userId: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: authError } = await context.supabase.rpc('is_admin');
    if (authError || isAdmin !== true) throw new Error('Endast admin kan ta bort användare');
    if (data.userId === context.userId) throw new Error('Du kan inte ta bort dig själv');
    const prepared = await context.supabase.rpc('admin_prepare_user_deletion' as never, { p_user_id: data.userId } as never);
    if (prepared.error) throw new Error('Kunde inte förbereda borttagningen. Hantera eventuella kommande skoluppdrag först.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const db = supabaseAdmin as SupabaseClient;
    const id = data.userId;
    const checked = async (operation: PromiseLike<{ error: unknown }>) => {
      const result = await operation;
      if (result.error) throw new Error('deletion_step_failed');
    };
    try {
      const { data: job, error } = await db.from('account_deletion_jobs').select('stage').eq('user_id', id).single();
      if (error || !job) throw new Error('missing_deletion_job');
      if (job.stage === 'completed') return { ok: true };
      // Database deactivation already blocks booking/role access even if Auth is temporarily unavailable.
      const banned = await db.auth.admin.updateUserById(id, { ban_duration: '876000h' });
      if (banned.error && banned.error.status !== 404) throw new Error('auth_deactivation_failed');
      if (job.stage === 'prepared') {
        for (const bucket of ['background-checks', 'cvs', 'avatars']) {
          while (true) {
            const files = await db.storage.from(bucket).list(id, { limit: 100 });
            if (files.error) throw new Error('storage_list_failed');
            if (!files.data?.length) break;
            await checked(db.storage.from(bucket).remove(files.data.map((file) => `${id}/${file.name}`)));
          }
        }
        await checked(db.from('account_deletion_jobs').update({ stage: 'files_removed', updated_at: new Date().toISOString() }).eq('user_id', id));
      }
      if (job.stage === 'prepared' || job.stage === 'files_removed') {
        await checked(db.rpc('finalize_user_deletion_data', { p_user_id: id }));
      }
      const removed = await db.auth.admin.deleteUser(id);
      if (removed.error && removed.error.status !== 404) throw new Error('auth_deletion_failed');
      await checked(db.from('account_deletion_jobs').update({ stage: 'completed', last_error: null, updated_at: new Date().toISOString() }).eq('user_id', id));
      return { ok: true };
    } catch {
      await db.from('account_deletion_jobs').update({ last_error: 'cleanup_incomplete', updated_at: new Date().toISOString() }).eq('user_id', id);
      throw new Error('Kontot är avaktiverat men borttagningen är inte klar. Försök igen för att fortsätta samma borttagning.');
    }
  });
