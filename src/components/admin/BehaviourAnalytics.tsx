import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";

import {
  getBehaviourHeatmap,
  getBehaviourRecommendations,
  getBehaviourSummary,
} from "@/lib/behaviour.functions";
import { experienceScore, WEAKNESS_LABELS } from "@/lib/behaviour-score";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DEVICE_LABELS: Record<string, string> = { desktop: "Dator", tablet: "Surfplatta", mobile: "Mobil" };
const HEAT_COLORS: Record<string, string> = {
  click: "var(--primary)",
  rage_click: "var(--destructive)",
  dead_click: "#E08A00",
  move: "var(--muted-foreground)",
};

function scoreClass(score: number) {
  return score >= 80 ? "text-success" : score >= 60 ? "text-foreground" : "text-destructive";
}

export function BehaviourAnalytics() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [heatPath, setHeatPath] = useState<string | null>(null);
  const [heatDevice, setHeatDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showMoves, setShowMoves] = useState(false);
  const fetchSummary = useServerFn(getBehaviourSummary);
  const fetchHeat = useServerFn(getBehaviourHeatmap);
  const fetchAdvice = useServerFn(getBehaviourRecommendations);

  const summary = useQuery({
    queryKey: ["admin", user?.id, "behaviour", days],
    queryFn: () => fetchSummary({ data: { days } }),
    enabled: !!user,
  });
  const pages = summary.data?.pages ?? [];
  const selectedPath = heatPath ?? pages[0]?.path ?? null;
  const heat = useQuery({
    queryKey: ["admin", user?.id, "behaviour-heat", days, selectedPath, heatDevice],
    queryFn: () => fetchHeat({ data: { days, path: selectedPath!, device: heatDevice } }),
    enabled: !!user && !!selectedPath,
  });
  const advice = useMutation({ mutationFn: () => fetchAdvice({ data: { days } }) });

  const scored = useMemo(
    () => pages.map((p) => ({ ...p, ...experienceScore(p) })).sort((a, b) => a.score - b.score),
    [pages],
  );
  const s = summary.data;
  const totalRage = pages.reduce((a, p) => a + Number(p.rage_clicks), 0);
  const totalDead = pages.reduce((a, p) => a + Number(p.dead_clicks), 0);
  const abandons = pages.reduce((a, p) => a + Number(p.form_abandons), 0);
  const submits = pages.reduce((a, p) => a + Number(p.form_submits), 0);
  const points = (heat.data ?? []).filter((p) => showMoves || p.event_type !== "move");

  return (
    <section className="space-y-4" aria-labelledby="behaviour-title">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="min-w-0">
          <h2 id="behaviour-title" className="text-xl font-extrabold">Beteendeanalys</h2>
          <p className="text-sm text-muted-foreground">
            Anonym data från besökare som godkänt analys. Formulärinnehåll och lösenord sparas aldrig; data raderas efter 90 dagar.
          </p>
        </div>
        <select
          aria-label="Period"
          className="h-10 rounded-field border border-input bg-background px-3 text-sm"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>7 dagar</option>
          <option value={30}>30 dagar</option>
          <option value={90}>90 dagar</option>
        </select>
      </div>

      {summary.isError && <p role="alert" className="text-sm text-destructive">Kunde inte hämta beteendeanalysen.</p>}
      {summary.isLoading && <p className="text-sm text-muted-foreground">Hämtar…</p>}

      {s && s.totals.visits === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Inga besök registrerade ännu under perioden. Data samlas in på den publicerade sidan och i förhandsvisningen när besökare godkänner analys.
          </CardContent>
        </Card>
      )}

      {s && s.totals.visits > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Besök", s.totals.visits],
              ["Sidvisningar", s.totals.page_views],
              ["Frustrerade / döda klick", `${totalRage} / ${totalDead}`],
              ["Formulär slutförda", submits + abandons === 0 ? "–" : `${Math.round((100 * submits) / (submits + abandons))} %`],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="text-3xl">{value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Enheter: {s.devices.map((d) => `${DEVICE_LABELS[d.device] ?? d.device} ${d.visits}`).join(" · ")}
          </p>

          <Card>
            <CardHeader>
              <CardTitle>Förbättringsförslag</CardTitle>
              <CardDescription>AI analyserar den insamlade datan och föreslår vad ni bör ändra först.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => advice.mutate()} disabled={advice.isPending} className="min-h-11">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {advice.isPending ? "Analyserar…" : "Ta fram förslag"}
              </Button>
              {advice.data?.note && <p className="text-sm text-muted-foreground">{advice.data.note}</p>}
              <ol className="grid gap-3">
                {advice.data?.items.map((r, i) => (
                  <li key={i} className="rounded-panel border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.priority === "hög" ? "bg-destructive text-destructive-foreground" : "bg-muted"}`}>
                        {r.priority}
                      </span>
                      <span className="font-semibold">{r.title}</span>
                      <span className="text-xs text-muted-foreground">{r.page}</span>
                    </div>
                    <p className="mt-1 text-sm"><strong>Varför:</strong> {r.why}</p>
                    <p className="text-sm"><strong>Gör så här:</strong> {r.how}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sidor och upplevelsepoäng</CardTitle>
              <CardDescription>Sämst först. Poängen (0–100) väger frustrerade och döda klick, scrolldjup, ignorerade sidor, övergivna formulär och utgångar.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Sida</th><th className="pr-3">Poäng</th><th className="pr-3">Visningar</th>
                    <th className="pr-3">Tid</th><th className="pr-3">Scroll</th><th className="pr-3">Lämnar här</th><th>Största svaghet</th>
                  </tr>
                </thead>
                <tbody>
                  {scored.map((p) => (
                    <tr key={p.path} className="border-t border-border">
                      <td className="py-2 pr-3 font-medium">{p.path}</td>
                      <td className={`pr-3 font-bold ${scoreClass(p.score)}`}>{p.score}</td>
                      <td className="pr-3">{p.views}</td>
                      <td className="pr-3">{p.avg_seconds ?? "–"} s</td>
                      <td className="pr-3">{p.avg_scroll ?? "–"} %</td>
                      <td className="pr-3">{p.exits}</td>
                      <td className="text-muted-foreground">{p.weakness ? WEAKNESS_LABELS[p.weakness] : "Inga tydliga problem"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Värmekarta</CardTitle>
              <CardDescription>Var på sidan besökarna klickar. Positionen är relativ till hela sidans bredd och höjd.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <select aria-label="Sida" className="h-10 rounded-field border border-input bg-background px-3 text-sm" value={selectedPath ?? ""} onChange={(e) => setHeatPath(e.target.value)}>
                  {pages.map((p) => <option key={p.path} value={p.path}>{p.path}</option>)}
                </select>
                <select aria-label="Enhet" className="h-10 rounded-field border border-input bg-background px-3 text-sm" value={heatDevice} onChange={(e) => setHeatDevice(e.target.value as typeof heatDevice)}>
                  <option value="desktop">Dator</option><option value="tablet">Surfplatta</option><option value="mobile">Mobil</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showMoves} onChange={(e) => setShowMoves(e.target.checked)} /> Visa musrörelser
                </label>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />Klick</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-destructive" />Frustrerade klick</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#E08A00" }} />Döda klick</span>
              </div>
              <div
                className="relative w-full overflow-hidden rounded-panel border border-border bg-muted/30"
                style={{ aspectRatio: heatDevice === "mobile" ? "9 / 16" : "4 / 5", maxWidth: heatDevice === "mobile" ? 320 : 640 }}
                role="img"
                aria-label={`Värmekarta med ${points.length} punkter`}
              >
                {points.map((p, i) => (
                  <span
                    key={i}
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, background: HEAT_COLORS[p.event_type], opacity: p.event_type === "move" ? 0.15 : 0.35, filter: "blur(2px)" }}
                  />
                ))}
                {!points.length && <p className="p-4 text-sm text-muted-foreground">Inga klick för detta urval.</p>}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Mest klickade element</CardTitle>
                <CardDescription>Element med frustrerade eller döda klick behöver ses över.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-sm">
                  {s.elements.slice(0, 15).map((e) => (
                    <li key={`${e.path}${e.element}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <span className="min-w-0 truncate">{e.element} <span className="text-muted-foreground">({e.path})</span></span>
                      <span className="shrink-0 tabular-nums">
                        {e.clicks}{e.rage > 0 && <span className="ml-2 text-destructive">⚡{e.rage}</span>}{e.dead > 0 && <span className="ml-2 text-muted-foreground">✕{e.dead}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Vanligaste besöksvägar</CardTitle>
                <CardDescription>De första fyra sidorna i varje besök.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-sm">
                  {s.journeys.map((j) => (
                    <li key={j.steps} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <span className="min-w-0 break-words">{j.steps}</span>
                      <span className="shrink-0 tabular-nums">{j.visits}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
