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
import { SUBJECTS } from "@/lib/subjects";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "REKO UF — akuta lärarvikarier till gymnasieskolor" }], component: undefined }),
  component: Index,
});

const requestSchema = z.object({
  school_name: z.string().trim().min(2, "Ange skolans namn").max(120),
  contact_person: z.string().trim().min(2, "Ange kontaktperson").max(120),
  contact_email: z.string().trim().email("Ogiltig e-postadress").max(255).or(z.literal("")),
  contact_phone: z.string().trim().max(40),
  subject: z.string().trim().max(120),
  desired_date: z.string().optional(),
  description: z.string().trim().min(5, "Beskriv behovet kort").max(1000),
});

function Index() {
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState("");
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
      subject,
      desired_date: String(fd.get("desired_date") ?? ""),
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
    const details = [
      parsed.data.subject ? `Ämne: ${parsed.data.subject}` : "",
      parsed.data.desired_date ? `Önskat datum: ${parsed.data.desired_date}` : "",
      parsed.data.description,
    ]
      .filter(Boolean)
      .join("\n");
    const { error } = await supabase.from("school_requests").insert({
      school_name: parsed.data.school_name,
      contact_person: parsed.data.contact_person,
      contact_email: parsed.data.contact_email || null,
      contact_phone: parsed.data.contact_phone || null,
      description: details,
    });
    setSaving(false);
    if (error) {
      toast.error("Något gick fel. Försök igen om en stund.");
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
    <section className="relative overflow-hidden"><div className="absolute inset-0 -z-10 bg-gradient-brand opacity-[0.06]" /><div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:py-20"><div className="flex flex-col justify-center"><span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">Vikarieförmedling för gymnasiet</span><h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">Sjuk lärare? <br />Vi hittar vikarien.</h1><p className="mt-4 text-base text-muted-foreground md:text-lg">REKO UF kopplar ihop gymnasieskolor med granskade vikarier. Ni hör av er, vi matchar, första vikarien som kan tar uppdraget.</p><div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg"><a href="#behov">Anmäl ett vikariebehov <ArrowRight className="h-4 w-4" /></a></Button><Button asChild size="lg" variant="outline"><Link to="/auth">Bli vikarie</Link></Button></div></div><div className="grid gap-4 self-center sm:grid-cols-2">{[{icon:Clock,title:"Snabbt svar",text:"Matchande vikarier notifieras direkt."},{icon:ShieldCheck,title:"Granskade vikarier",text:"Utdrag kontrolleras före matchning."},{icon:Users,title:"Egna elever",text:"Vikarier som känner skolan."},{icon:CheckCircle2,title:"Ingen inloggning för skolan",text:"Vi sköter administrationen åt er."}].map(f=><Card key={f.title} className="border-border/70 shadow-soft"><CardContent className="pt-6"><f.icon className="h-6 w-6 text-primary" /><h3 className="mt-3 font-semibold">{f.title}</h3><p className="mt-1 text-sm text-muted-foreground">{f.text}</p></CardContent></Card>)}</div></div></section>
    <section id="behov" className="mx-auto max-w-3xl px-4 py-14"><Card className="shadow-lift"><CardHeader><CardTitle className="text-2xl">Behöver din skola en vikarie?</CardTitle><CardDescription>Skicka en förfrågan så återkommer vi. Den skapar inte automatiskt en annons.</CardDescription></CardHeader><CardContent>{sent ? <div className="rounded-xl bg-secondary p-6 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-success" /><p className="mt-3 font-semibold">Tack! Förfrågan är skickad.</p></div> : <form className="grid gap-4" onSubmit={handleSubmit}><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="school_name">Skola</Label><Input id="school_name" name="school_name" required /></div><div className="grid gap-2"><Label htmlFor="contact_person">Kontaktperson</Label><Input id="contact_person" name="contact_person" required /></div><div className="grid gap-2"><Label htmlFor="contact_email">E-post</Label><Input id="contact_email" name="contact_email" type="email" /></div><div className="grid gap-2"><Label htmlFor="contact_phone">Telefon</Label><Input id="contact_phone" name="contact_phone" /></div><div className="grid gap-2"><Label>Ämne</Label><Select value={subject} onValueChange={setSubject}><SelectTrigger><SelectValue placeholder="Välj ämne" /></SelectTrigger><SelectContent><SelectItem value="Ingen speciell">Ingen speciell</SelectItem>{SUBJECTS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="desired_date">Önskat datum</Label><Input id="desired_date" name="desired_date" type="date" /></div></div><div className="grid gap-2"><Label htmlFor="description">Beskriv behovet</Label><Textarea id="description" name="description" rows={4} required /></div><Button type="submit" size="lg" disabled={saving}>{saving ? "Skickar…" : "Skicka förfrågan"}</Button></form>}</CardContent></Card></section>
    <footer className="border-t border-border/70 bg-card"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-muted-foreground">© {new Date().getFullYear()} REKO UF</span><button onClick={()=>setShowAdminLogin(!showAdminLogin)} className="text-xs text-muted-foreground/50 hover:text-muted-foreground">{showAdminLogin?<><span>✕</span></>:<><LogIn className="inline h-3 w-3" /></>}</button></div>{showAdminLogin&&<div className="mx-auto max-w-6xl px-4 pb-8"><Card><CardHeader><CardTitle>Admin-inloggning</CardTitle></CardHeader><CardContent><form className="grid max-w-sm gap-4" onSubmit={handleAdminLogin}><Input type="email" placeholder="E-post" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} required /><Input type="password" placeholder="Lösenord" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} required /><Button disabled={adminLogging}>{adminLogging?"Loggar in…":"Logga in"}</Button></form></CardContent></Card></div>}</footer>
  </div>;
}
