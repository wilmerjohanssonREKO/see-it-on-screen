import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock, ShieldCheck, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "REKO UF — akuta lärarvikarier till gymnasieskolor" },
    { name: "description", content: "REKO UF matchar gymnasieskolor med granskade vikarier. Kontakta oss för att få ett skolkonto eller registrera dig som vikarie." },
    { property: "og:title", content: "REKO UF — akuta lärarvikarier till gymnasieskolor" },
    { property: "og:description", content: "Granskade vikarier för gymnasieskolor. Kontakta REKO UF för ett skolkonto." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

function Index() {
  return <div className="flex min-h-screen flex-col bg-background"><AppHeader />
    <section className="relative flex-1 overflow-hidden"><div className="absolute inset-0 -z-10 bg-gradient-to-b from-hero-tint/60 to-transparent" /><div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:py-20"><div className="flex flex-col justify-center"><span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">Vikarieförmedling för gymnasiet</span><h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">Sjuk lärare? <br />Vi hittar vikarien.</h1><p className="mt-4 text-base text-muted-foreground md:text-lg">REKO UF kopplar ihop gymnasieskolor med granskade vikarier. Ni hör av er, vi sätter upp ett konto åt er, och därefter lägger ni själva upp era vikariebehov.</p><div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/kontakt">Bli skolpartner <ArrowRight className="h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="border-primary bg-card text-primary hover:bg-primary/5 hover:text-primary"><Link to="/auth">Bli vikarie</Link></Button></div></div><div className="grid gap-4 self-center sm:grid-cols-2">{[{icon:Clock,title:"Snabbt svar",text:"Alla godkända vikarier ser ert behov direkt."},{icon:ShieldCheck,title:"Granskade vikarier",text:"Vikarier granskas före matchning."},{icon:Users,title:"Egna elever",text:"Vikarier som känner skolan."},{icon:CheckCircle2,title:"Eget skolkonto",text:"Kontakta oss så sätter vi upp ett konto åt er."}].map(f=><Card key={f.title} className="border-border/70 bg-card shadow-soft"><CardContent className="pt-6"><f.icon className="h-6 w-6 text-primary" /><h3 className="mt-3 font-semibold">{f.title}</h3><p className="mt-1 text-sm text-muted-foreground">{f.text}</p></CardContent></Card>)}</div></div></section>
    <PublicFooter />
  </div>;
}
