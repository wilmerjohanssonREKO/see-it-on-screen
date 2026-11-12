import { Button } from "@/components/ui/button";

export function QueryError({ retry, message = "Kunde inte hämta uppgifterna." }: { retry: () => void; message?: string }) {
  return <div role="alert" className="rounded-panel border border-destructive/40 p-4 text-sm">
    <p>{message}</p>
    <Button type="button" variant="outline" className="mt-3 min-h-11" size="sm" onClick={retry}>Försök igen</Button>
  </div>;
}
