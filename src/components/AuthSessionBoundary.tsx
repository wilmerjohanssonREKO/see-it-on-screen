import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { clearPrivateCache, identityChanged } from "@/lib/auth-cache";

/** Private screens remount on identity changes, including logout in another tab. */
export function AuthSessionBoundary({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const router = useRouter();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const [identity, setIdentity] = useState<string | null | undefined>();
  useEffect(() => {
    let active = true;
    let previous: string | null | undefined;
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const next = session?.user.id ?? null;
      if (identityChanged(previous, next)) {
        clearPrivateCache(client);
        // Supabase callbacks must not await further auth work while its lock is held.
        queueMicrotask(() => { if (active) void router.invalidate(); });
      }
      previous = next;
      setIdentity(next);
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, [client, router]);
  const privatePage = ["/admin", "/profil", "/uppdrag", "/skola", "/feedback"].includes(pathname);
  if (identity === undefined && privatePage) return <p className="p-4 text-muted-foreground" role="status">Laddar…</p>;
  return <Fragment key={privatePage ? (identity ?? "signed-out") : "public"}>{children}</Fragment>;
}
