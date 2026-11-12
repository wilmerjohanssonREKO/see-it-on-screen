import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAvatarUrls } from "@/lib/avatar.functions";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createScopedBatchLoader } from "@/lib/batch-loader";

const batchAvatar = createScopedBatchLoader<string>();

function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return (
    (
      (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")
    ).toUpperCase() || "?"
  );
}

export function SubstituteAvatar({
  id,
  name,
  className,
}: {
  id: string | null | undefined;
  name: string | null | undefined;
  className?: string;
}) {
  const fetchUrls = useServerFn(getAvatarUrls);
  const { user } = useAuth();
  const viewerId = user?.id;
  const { data: url } = useQuery({
    queryKey: ["avatar", id, viewerId],
    enabled: !!id && !!viewerId,
    staleTime: 4 * 60_000,
    queryFn: () =>
      batchAvatar(viewerId!, id!, async (ids) => {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user.id !== viewerId) throw new Error("Kontot har ändrats");
        return fetchUrls({ data: { ids } });
      }),
  });
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground",
        className,
      )}
    >
      {url ? (
        <img
          src={url}
          alt={name ? `Profilbild för ${name}` : "Profilbild"}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden={!!name}>{initials(name)}</span>
      )}
    </span>
  );
}
