import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PageStats } from "./behaviour-score";

export type BehaviourSummary = {
  days: number;
  totals: { visits: number; page_views: number };
  devices: { device: string; visits: number }[];
  pages: PageStats[];
  elements: { path: string; element: string; clicks: number; rage: number; dead: number }[];
  journeys: { steps: string; visits: number }[];
};

export type HeatPoint = { event_type: string; x: number; y: number };

export type Recommendation = {
  title: string;
  page: string;
  priority: "hög" | "medel" | "låg";
  why: string;
  how: string;
};

const daysSchema = z.object({ days: z.number().int().min(1).max(90).default(30) });

async function loadSummary(supabase: { rpc: (n: string, a: object) => PromiseLike<{ data: unknown; error: unknown }> }, days: number) {
  const { data, error } = await supabase.rpc("admin_behaviour_summary", { p_days: days });
  if (error) throw new Error("Kunde inte hämta beteendeanalysen");
  return data as BehaviourSummary;
}

export const getBehaviourSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => daysSchema.parse(input))
  .handler(async ({ data, context }) => loadSummary(context.supabase as never, data.days));

export const getBehaviourHeatmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    daysSchema.extend({ path: z.string().min(1).max(120), device: z.enum(["mobile", "tablet", "desktop"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<HeatPoint[]> => {
    const { data: rows, error } = await context.supabase.rpc("admin_behaviour_heatmap", {
      p_path: data.path,
      p_days: data.days,
      p_device: data.device,
    });
    if (error) throw new Error("Kunde inte hämta värmekartan");
    return (rows ?? []) as HeatPoint[];
  });

export const MIN_VISITS_FOR_ADVICE = 20;

export const getBehaviourRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => daysSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ items: Recommendation[]; note: string | null }> => {
    const summary = await loadSummary(context.supabase as never, data.days);
    if (summary.totals.visits < MIN_VISITS_FOR_ADVICE) {
      return { items: [], note: `Bara ${summary.totals.visits} besök hittills — förslagen blir pålitliga först efter minst ${MIN_VISITS_FOR_ADVICE} besök.` };
    }
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "Du är UX-analytiker för REKO UF, en vikarieförmedling för gymnasieskolor (vikarier, skolor, lärare och admin). Analysera de anonyma beteendedata du får. Hitta problem, förvirrande element, förbisedda knappar och möjligheter att få fler att slutföra viktiga steg (registrering, inloggning, publicera behov, anmäla intresse). Använd ENDAST siffrorna i datan, hitta aldrig på statistik, och nämn siffrorna som motivering. Ge 3–6 konkreta förslag på svenska, sorterade efter vikt. Skriv sidor som sökvägar ur datan.",
        input: JSON.stringify(summary),
        text: {
          format: {
            type: "json_schema",
            name: "recommendations",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["items"],
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["title", "page", "priority", "why", "how"],
                    properties: {
                      title: { type: "string" },
                      page: { type: "string" },
                      priority: { type: "string", enum: ["hög", "medel", "låg"] },
                      why: { type: "string" },
                      how: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      });
      const text = res.output
        .flatMap((item) => (item.type === "message" ? item.content : []))
        .map((c) => (c.type === "output_text" ? c.text : ""))
        .join("");
      const parsed = JSON.parse(text) as { items: Recommendation[] };
      return { items: parsed.items, note: null };
    } catch (err) {
      if (err instanceof GatewayError) console.error("AI-rekommendationer misslyckades", err.code, err.ids);
      else console.error(err);
      return { items: [], note: "Kunde inte ta fram förslag just nu. Försök igen om en stund." };
    }
  });
