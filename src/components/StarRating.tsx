import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function formatRating(avg: number | null | undefined, count: number | null | undefined) {
  if (!count) return "Inga betyg än";
  return `${Number(avg ?? 0).toLocaleString("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${count} betyg)`;
}

export function RatingSummary({ avg, count }: { avg: number | null | undefined; count: number | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <Star className="h-3.5 w-3.5 fill-accent text-accent" /> {formatRating(avg, count)}
    </span>
  );
}

export function StarRatingForm({
  label,
  onSubmit,
}: {
  label: string;
  onSubmit: (score: number, comment: string) => Promise<void>;
}) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Betyg 1–5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={score === n}
            aria-label={`${n} av 5`}
            onClick={() => setScore(n)}
            className="p-0.5"
          >
            <Star className={`h-6 w-6 ${n <= score ? "fill-accent text-accent" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Kort kommentar (valfritt, max 500 tecken)"
      />
      <Button
        size="sm"
        className="w-fit"
        disabled={!score || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSubmit(score, comment);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Skickar…" : "Skicka betyg"}
      </Button>
      <p className="text-xs text-muted-foreground">Betyget kan inte ändras efteråt.</p>
    </div>
  );
}
