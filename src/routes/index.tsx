import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Clock, ShieldCheck, Users, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLogging, setAdminLogging] = useState(false);

  async function handleAdminLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAdminLogging(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
    if (error || !data.user) {
      setAdminLogging(false);
      toast.error("Felaktig e-post eller lösenord");
      return;
    }
    const { data: admin, error: roleError } = await supabase.rpc("is_admin");
    setAdminLogging(false);
    if (roleError || !admin) {
      await supabase.auth.signOut();
      toast.error("Kontot har inte adminbehörighet");
      return;
    }
    window.location.href = "/admin";
  }

  return <div className="min-h-screen bg-background"><AppHeader />
     <section className="relative overflow-hidden"><div className="absolute inset-0 -z-10 bg-gradient-brand opacity-[0.06]" /><div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:py-20"><div className="flex flex-col justify-center"><span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">Vikarieförmedling för gymnasiet</span><h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">Sjuk lärare? <br />Vi hittar vikarien.</h1><p className="mt-4 text-base text-muted-foreground md:text-lg">REKO UF kopplar ihop gymnasieskolor med granskade vikarier. Ni hör av er, vi matchar, första vikarien som kan tar uppdraget.</p><div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/kontakt">Kontakta oss <ArrowRight className="h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline"><Link to="/auth">Bli vikarie</Link></Button></div></div><div className="grid gap-4 self-center sm:grid-cols-2">{[{icon:Clock,title:"Snabbt svar",text:"Matchande vikarier notifieras direkt."},{icon:ShieldCheck,title:"Granskade vikarier",text:"Vikarier granskas före matchning."},{icon:Users,title:"Egna elever",text:"Vikarier som känner skolan."},{icon:CheckCircle2,title:"Eget skolkonto",text:"Kontakta oss så sätter vi upp ett konto åt er."}].map(f=><Card key={f.title} className="border-border/70 shadow-soft"><CardContent className="pt-6"><f.icon className="h-6 w-6 text-primary" /><h3 className="mt-3 font-semibold">{f.title}</h3><p className="mt-1 text-sm text-muted-foreground">{f.text}</p></CardContent></Card>)}</div></div></section>
    <footer className="border-t border-border/70 bg-card"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-muted-foreground">© {new Date().getFullYear()} REKO UF</span><button onClick={()=>setShowAdminLogin(!showAdminLogin)} className="text-xs text-muted-foreground/50 hover:text-muted-foreground">{showAdminLogin?<><span>✕</span></>:<><LogIn className="inline h-3 w-3" /></>}</button></div>{showAdminLogin&&<div className="mx-auto max-w-6xl px-4 pb-8"><Card><CardHeader><CardTitle>Admin-inloggning</CardTitle></CardHeader><CardContent><form className="grid max-w-sm gap-4" onSubmit={handleAdminLogin}><Input type="email" placeholder="E-post" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} required /><Input type="password" placeholder="Lösenord" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} required /><Button disabled={adminLogging}>{adminLogging?"Loggar in…":"Logga in"}</Button></form></CardContent></Card></div>}</footer>
  </div>;
}
