import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { listTeachers, removeTeacher } from "@/lib/teacher.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function TeachersTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchTeachers = useServerFn(listTeachers);
  const remove = useServerFn(removeTeacher);
  const { data } = useQuery({
    queryKey: ["admin-teachers", user?.id],
    enabled: !!user,
    queryFn: () => fetchTeachers(),
  });
  async function del(userId: string) {
    if (!window.confirm("Ta bort läraren från skolan? Hen kan inte längre publicera vikariebehov."))
      return;
    try {
      await remove({ data: { userId } });
      toast.success("Läraren är borttagen. En ny personlig inbjudan krävs för att gå med igen.");
      qc.invalidateQueries({ queryKey: ["admin-teachers"] });
    } catch {
      toast.error("Kunde inte ta bort läraren");
    }
  }
  return (
    <div className="mt-4 grid gap-3">
      {data?.length === 0 && <p className="text-muted-foreground">Inga lärarkonton än.</p>}
      {data?.map((t) => (
        <Card key={t.userId}>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-6">
            <div>
              <p className="font-semibold">
                {t.name || "—"} · {t.schoolName}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.email}
                {t.phone ? ` · ${t.phone}` : ""}
              </p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => del(t.userId)}>
              <Trash2 className="h-4 w-4" /> Ta bort
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
