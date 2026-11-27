export type PageStats = {
  path: string;
  views: number;
  avg_scroll: number | null;
  avg_seconds: number | null;
  clicks: number;
  rage_clicks: number;
  dead_clicks: number;
  form_abandons: number;
  form_submits: number;
  no_click_share: number;
  exits: number;
  entries: number;
};

export type Weakness = "rage" | "dead" | "scroll" | "ignored" | "forms" | "exits";

export const WEAKNESS_LABELS: Record<Weakness, string> = {
  rage: "Frustrerade klick (många snabba klick på samma ställe)",
  dead: "Klick på saker som inte går att klicka på",
  scroll: "Besökare scrollar inte långt ned",
  ignored: "Många besök utan ett enda klick",
  forms: "Formulär påbörjas men skickas inte",
  exits: "Många lämnar sidan härifrån",
};

/** 0–100 experience score per page; higher is better. Returns the biggest weakness. */
export function experienceScore(p: PageStats): { score: number; weakness: Weakness | null } {
  const views = Math.max(p.views, 1);
  const formsStarted = p.form_abandons + p.form_submits;
  const penalties: Record<Weakness, number> = {
    rage: Math.min(25, (p.rage_clicks / views) * 100),
    dead: Math.min(15, (p.dead_clicks / views) * 15),
    scroll: p.avg_scroll === null ? 0 : Math.min(15, ((100 - p.avg_scroll) / 100) * 15),
    ignored: Math.min(15, (p.no_click_share / 100) * 15),
    forms: formsStarted === 0 ? 0 : Math.min(20, (p.form_abandons / formsStarted) * 20),
    exits: Math.min(10, (p.exits / views) * 10),
  };
  const total = Object.values(penalties).reduce((a, b) => a + b, 0);
  let weakness: Weakness | null = null;
  let worst = 2;
  for (const [key, value] of Object.entries(penalties) as [Weakness, number][]) {
    if (value > worst) {
      worst = value;
      weakness = key;
    }
  }
  return { score: Math.max(0, Math.round(100 - total)), weakness };
}

/** Normalizes a pathname so IDs never end up in analytics. */
export function normalizePath(pathname: string): string {
  const clean = pathname
    .split("/")
    .map((seg) => (/^[0-9a-f-]{16,}$/i.test(seg) || /^\d{3,}$/.test(seg) ? ":id" : seg))
    .join("/")
    .slice(0, 120);
  return clean || "/";
}
