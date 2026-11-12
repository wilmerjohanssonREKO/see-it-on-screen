import { Button } from "@/components/ui/button";

export function PageControls({
  page,
  hasNext,
  busy,
  onPage,
}: {
  page: number;
  hasNext: boolean;
  busy: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <nav aria-label="Sidindelning" className="flex items-center justify-between gap-3 py-3">
      <Button variant="outline" disabled={busy || page === 0} onClick={() => onPage(page - 1)}>
        Föregående
      </Button>
      <span className="text-sm text-muted-foreground">Sida {page + 1}</span>
      <Button variant="outline" disabled={busy || !hasNext} onClick={() => onPage(page + 1)}>
        Nästa
      </Button>
    </nav>
  );
}
