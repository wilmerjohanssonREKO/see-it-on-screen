import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Row = { id: string; name: string; is_test: boolean };

export function SandboxTab() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin-sandbox"],
    queryFn: async () => {
      const [schools, subs, mails] = await Promise.all([
        supabase.from("schools").select("id, name, is_test").order("name"),
        supabase.from("profiles").select("id, full_name, is_test").order("full_name"),
        supabase.from("sandbox_emails").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      return {
        schools: (schools.data ?? []).map((s) => ({ id: s.id, name: s.name, is_test: s.is_test })) as Row[],
        subs: (subs.data ?? []).map((p) => ({ id: p.id, name: p.full_name || "(namnlös)", is_test: p.is_test })) as Row[],
        mails: mails.data ?? [],
      };
    },
  });

  async function toggle(kind: "school" | "substitute", row: Row) {
    const { error } = await supabase.rpc("admin_set_test", { p_kind: kind, p_id: row.id, p_value: !row.is_test });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-sandbox"] });
  }

  async function purge() {
    if (!confirm("Radera alla testuppdrag och testmejl? Riktiga uppdrag påverkas inte.")) return;
    const { data: n, error } = await supabase.rpc("purge_sandbox_data");
    if (error) { toast.error(error.message); return; }
    toast.success(`${n ?? 0} testuppdrag raderade`);
    qc.invalidateQueries({ queryKey: ["admin-sandbox"] });
  }

  const list = (kind: "school" | "substitute", rows: Row[]) => (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0 truncate">
            {r.is_test && <span className="mr-2 rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground">TEST</span>}
            {r.name}
          </span>
          <Button size="sm" variant={r.is_test ? "default" : "outline"} onClick={() => toggle(kind, r)}>
            {r.is_test ? "Gör riktig" : "Gör till test"}
          </Button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mt-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sandlådeläge</CardTitle>
          <CardDescription>
            Testskolor och testvikarier ser bara varandra. Mejl till testkonton skickas aldrig — de hamnar i testinkorgen nedan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={purge}>Rensa all testdata</Button>
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Skolor</CardTitle></CardHeader>
          <CardContent>{list("school", data?.schools ?? [])}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Användare</CardTitle></CardHeader>
          <CardContent>{list("substitute", data?.subs ?? [])}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Testinkorg</CardTitle></CardHeader>
        <CardContent>
          {!data?.mails.length ? (
            <p className="text-muted-foreground">Inga fångade testmejl.</p>
          ) : (
            <ul className="divide-y">
              {data.mails.map((m) => (
                <li key={m.id} className="py-2 text-sm">
                  <div className="font-semibold">{m.template} → {m.recipient}</div>
                  <div className="text-muted-foreground">
                    {new Date(m.created_at).toLocaleString("sv-SE")} · {JSON.stringify(m.data)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
