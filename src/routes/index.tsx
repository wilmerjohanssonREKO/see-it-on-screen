import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Clock, ShieldCheck, Users, LogIn } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "REKO UF — akuta lärarvikarier till gymnasieskolor" },
      { name: "description", content: "Behöver din skola en vikarie? REKO UF matchar ert behov mot granskade vikarier." },
      { property: "og:title", content: "REKO UF — akuta lärarvikarier till gymnasieskolor" },
      { property: "og:description", content: "Hör av dig med ert vikariebehov så matchar vi det mot granskade vikarier." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const requestSchema = z.object({
  school_name: z.string().trim().min(2, "Ange skolans namn").max(120),
  contact_person: z.string().trim().min(2, "Ange kontaktperson").max(120),
  contact_email: z.string().trim().email("Ogiltig e-postadress").max(255).or(z.literal("")),
  contact_phone: z.string().trim().max(40),
  description: z.string().trim().min(5, "Beskriv behovet kort").max(1000),
});

function Index() {
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLogging, setAdminLogging] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = requestSchema.safeParse({
      school_name: String(fd.get("school_name") ?? ""),
      contact_person: String(fd.get("contact_person") ?? ""),
      contact_email: String(fd.get("contact_email") ?? ""),
      contact_phone: String(fd.get("contact_phone") ?? ""),
      description: String(fd.get("description") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Kontrollera fälten");
      return;
    }
    if (!parsed.data.contact_email && !parsed.data.contact_phone) {
      toast.error("Ange e-post eller telefonnummer så vi kan nå er");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("school_requests").insert({
      school_name: parsed.data.school_name,
      contact_person: parsed.data.contact_person,
      contact_email: parsed.data.contact_email || null,
      contact_phone: parsed.data.contact_phone || null,
      description: parsed.data.description,
    });
    setSaving(false);
    if (error) {
      toast.error("Något gick fel. Försök igen.");
      return;
    }
    setSent(true);
  }

  async function handleAdminLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAdminLogging(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
    if (error || !data.user) {
      setAdminLogging(false);
      toast.error("Felaktig e-post eller lösenord");
      return;
    }
    const { data: isAdmin, error: roleError } = await supabase.rpc("is_admin");
    setAdminLogging(false);
    if (roleError || !isAdmin) {
      await supabase.auth.signOut();
      toast.error("Kontot har inte adminbehörighet");
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-brand opacity-[0.06]" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div className="flex flex-col justify-center">
            <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">Vikarieförmedling för gymnasiet</span>
            <h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">Sjuk lärare i morgon? Vi hittar vikarien.</h1>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">REKO UF kopplar ihop gymnasieskolor med granskade vikarier — oftast före detta elever från er egen skola. Ni hör av er, vi matchar, första vikarien som kan tar uppdraget.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg"><a href="#behov">Anmäl ett vikariebehov <ArrowRight className="h-4 w-4" /></a></Button>
              <Button asChild size="lg" variant="outline"><Link to="/auth">Bli vikarie</Link></Button>
            </div>
          </div>
          <div className="grid gap-4 self-center sm:grid-cols-2">
            {[
              { icon: Clock, title: "Snabbt svar", text: "Matchande vikarier notifieras direkt när behovet läggs upp." },
              { icon: ShieldCheck, title: "Granskade vikarier", text: "Utdrag ur belastningsregistret kontrolleras innan någon matchas." },
              { icon: Users, title: "Egna elever", text: "Vikarier som redan känner skolan, ämnena och kulturen." },
              { icon: CheckCircle2, title: "Ingen inloggning för skolan", text: "Vi sköter administrationen åt er — ni får ett besked." },
            ].map((f) => <Card key={f.title} className="border-border/70 shadow-soft"><CardContent className="pt-6"><f.icon className="h-6 w-6 text-primary" /><h3 className="mt-3 text-base font-semibold">{f.title}</h3><p className="mt-1 text-sm text-muted-foreground">{f.text}</p></CardContent></Card>)}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-8"><div className="grid gap-4 rounded-2xl bg-card p-6 shadow-soft sm:grid-cols-3">{[["1. Ni hör av er", "Fyll i formuläret nedan, ring eller mejla oss med ert behov."], ["2. Vi matchar", "Vi lägger upp uppdraget och notifierar alla vikarier i rätt ämne."], ["3. Ni får ett namn", "Första vikarien som tackar ja tilldelas — vi hör av oss med kontaktuppgifter."]].map(([title, text]) => <div key={title}><h3 className="text-base font-semibold text-primary">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>)}</div></section>
      <section id="behov" className="mx-auto max-w-3xl px-4 py-14"><Card className="shadow-lift"><CardHeader><CardTitle className="text-2xl">Behöver din skola en vikarie?</CardTitle><CardDescription>Skicka en kort förfrågan så återkommer vi. Formuläret bokar ingen vikarie direkt — vi går igenom behovet och lägger upp det åt er.</CardDescription></CardHeader><CardContent>{sent ? <div className="rounded-xl bg-secondary p-6 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-success" /><p className="mt-3 font-semibold">Tack! Förfrågan är skickad.</p><p className="mt-1 text-sm text-muted-foreground">Vi hör av oss så snart vi gått igenom ert behov.</p></div> : <form className="grid gap-4" onSubmit={handleSubmit}><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="school_name">Skola</Label><Input id="school_name" name="school_name" maxLength={120} required /></div><div className="grid gap-2"><Label htmlFor="contact_person">Kontaktperson</Label><Input id="contact_person" name="contact_person" maxLength={120} required /></div><div className="grid gap-2"><Label htmlFor="contact_email">E-post</Label><Input id="contact_email" name="contact_email" type="email" maxLength={255} /></div><div className="grid gap-2"><Label htmlFor="contact_phone">Telefon</Label><Input id="contact_phone" name="contact_phone" maxLength={40} /></div></div><div className="grid gap-2"><Label htmlFor="description">Beskriv behovet</Label><Textarea id="description" name="description" rows={4} maxLength={1000} placeholder="T.ex. Matematik åk 2, fredag 10/10 kl 08:15–12:00" required /></div><Button type="submit" size="lg" disabled={saving}>{saving ? "Skickar…" : "Skicka förfrågan"}</Button></form>}</CardContent></Card></section>
      <footer className="border-t border-border/70 bg-card"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center"><span>© {new Date().getFullYear()} REKO UF</span><Link to="/auth" className="font-medium text-primary hover:underline">Logga in som vikarie</Link></div><button onClick={() => setShowAdminLogin(!showAdminLogin)} className="text-xs text-muted-foreground/50 hover:text-muted-foreground">{showAdminLogin ? "✕" : "⚙"}</button></div>{showAdminLogin && <div className="mx-auto max-w-6xl px-4 pb-8"><Card className="shadow-soft"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><LogIn className="h-4 w-4" /> Admin-inloggning</CardTitle></CardHeader><CardContent><form className="grid gap-4 sm:max-w-sm" onSubmit={handleAdminLogin}><div className="grid gap-2"><Label htmlFor="admin_email">E-post</Label><Input id="admin_email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required /></div><div className="grid gap-2"><Label htmlFor="admin_password">Lösenord</Label><Input id="admin_password" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required /></div><Button type="submit" disabled={adminLogging}>{adminLogging ? "Loggar in…" : "Logga in"}</Button></form></CardContent></Card></div>}</footer>
    </div>
  );
}
