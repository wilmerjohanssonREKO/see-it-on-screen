import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { getEmailOutbox, retryEmailOutbox, dispatchQueuedEmails } from '@/lib/assignment-emails.functions';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const labels: Record<string, string> = { pending: 'Väntar', sending: 'Skickas', retry: 'Nytt försök väntar', sent: 'Skickat', captured: 'Fångat testmejl', failed: 'Misslyckat', suppressed: 'Mottagaren spärrad', cancelled: 'Inaktuellt/stoppat' };
export function EmailOutboxPanel() {
  const { user } = useAuth();
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();
  const getQueue = useServerFn(getEmailOutbox);
  const retry = useServerFn(retryEmailOutbox);
  const dispatch = useServerFn(dispatchQueuedEmails);
  const queue = useQuery({ queryKey: ['admin-email-outbox', user?.id, offset], enabled: !!user,
    queryFn: () => getQueue({ data: { offset } }), refetchInterval: 30_000 });
  const mutation = useMutation({ mutationFn: async (id: string | null) => id ? retry({ data: { id } }) : dispatch(),
    onSuccess: () => { toast.success('Utskicksstatus uppdaterad'); void queryClient.invalidateQueries({ queryKey: ['admin-email-outbox'] }); },
    onError: () => toast.error('Kunde inte uppdatera utskickskön') });
  return <Card><CardHeader><CardTitle>Bokningsbesked</CardTitle>
    <CardDescription>Utskick sparas tillsammans med bokningen och försöks igen vid tillfälliga fel. Testmejl skickas aldrig externt.</CardDescription>
  </CardHeader><CardContent className="space-y-4">
    <Button variant="outline" disabled={mutation.isPending} onClick={() => {
      if (window.confirm('Bearbeta upp till 10 väntande utskick? Riktiga bokningsbesked kan skickas till sina mottagare.')) mutation.mutate(null);
    }}>Bearbeta väntande utskick</Button>
    {queue.isPending ? <p>Laddar utskick…</p> : queue.isError ? <p role="alert">Kunde inte läsa utskick. <Button variant="link" onClick={() => void queue.refetch()}>Försök igen</Button></p> :
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Tid</th><th className="p-2">Besked</th><th className="p-2">Mottagare</th><th className="p-2">Status</th><th className="p-2">Försök</th><th className="p-2">Åtgärd</th></tr></thead>
        <tbody>{queue.data?.map(row => <tr key={row.id} className="border-b"><td className="p-2">{new Date(row.created_at).toLocaleString('sv-SE')}</td><td className="p-2">{row.template}</td><td className="p-2">{row.recipient_kind === 'school' ? 'Skola' : 'Vikarie'}{row.test_snapshot ? ' (test)' : ''}</td><td className="p-2">{labels[row.status] ?? row.status}{row.last_error && <span className="block text-xs text-muted-foreground">{row.last_error}</span>}</td><td className="p-2">{row.attempts}</td><td className="p-2">{['failed', 'retry'].includes(row.status) && <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(row.id)}>Köa nytt försök</Button>}</td></tr>)}</tbody></table>
        {!queue.data?.length && <p className="py-4 text-muted-foreground">Inga bokningsbesked på denna sida.</p>}
      </div>}
    <div className="flex gap-3"><Button variant="outline" disabled={offset === 0 || queue.isFetching} onClick={() => setOffset(Math.max(0, offset - 50))}>Föregående</Button><Button variant="outline" disabled={queue.isFetching || (queue.data?.length ?? 0) < 50} onClick={() => setOffset(offset + 50)}>Nästa</Button></div>
  </CardContent></Card>;
}
