import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, UserRound } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/kontakt")({
  head: () => ({
    meta: [
      { title: "Kontakt — REKO UF" },
      { name: "description", content: "Vill din skola använda REKO UF? Kontakta oss så sätter vi upp ett konto åt er." },
      { property: "og:title", content: "Kontakt — REKO UF" },
      { property: "og:description", content: "Kontakta REKO UF för att få ett skolkonto för er gymnasieskola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KontaktPage,
});

function KontaktPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-14 md:py-20">
        <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">För gymnasieskolor</span>
        <h1 className="mt-4 text-4xl font-bold text-foreground">Kontakta REKO UF</h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">Vill din skola använda REKO UF? Kontakta oss så sätter vi upp ett konto åt er.</p>
        <dl className="mt-10 divide-y divide-border border-y border-border">
          {[
            { icon: UserRound, label: "Kontaktperson", value: "[ERT NAMN]" },
            { icon: Mail, label: "E-post", value: "[ER E-POST]" },
            { icon: Phone, label: "Telefon", value: "[ERT TELEFONNUMMER]" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-4 py-6">
              <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words font-medium text-foreground">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </main>
    </div>
  );
}