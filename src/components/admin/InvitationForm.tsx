import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createSchoolInvitation,
  listSchoolInvitations,
  revokeSchoolInvitation,
} from "@/lib/teacher.functions";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
export function InvitationForm({
  schoolId,
  defaultEmail = "",
  memberType,
}: {
  schoolId: string;
  defaultEmail?: string;
  memberType: "school" | "teacher";
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const create = useServerFn(createSchoolInvitation);
  const list = useServerFn(listSchoolInvitations);
  const revoke = useServerFn(revokeSchoolInvitation);
  const [busy, setBusy] = useState(false);
  const { data, isError } = useQuery({
    queryKey: ["school-invitations", user?.id],
    enabled: !!user,
    queryFn: () => list(),
  });
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    try {
      const res = await create({
        data: { schoolId, email: String(fd.get("email") ?? ""), memberType },
      });
      toast.success(
        res.delivery === "sandbox"
          ? "Testinbjudan fångad internt. Inget mejl skickades."
          : "Personlig inbjudan skickad. Gäller i 48 timmar.",
      );
      await qc.invalidateQueries({ queryKey: ["school-invitations"] });
      form.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skicka inbjudan");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 border-t border-border pt-4">
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Label htmlFor={`invite-${schoolId}-${memberType}`} className="sm:col-span-2">
          Bjud in {memberType === "teacher" ? "lärare" : "skolansvarig"}
        </Label>
        <Input
          id={`invite-${schoolId}-${memberType}`}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          placeholder="Personens e-postadress"
          required
          maxLength={255}
        />
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Skickar…" : "Skicka personlig inbjudan"}
        </Button>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Personen verifierar sin e-postadress och väljer själv lösenord.
        </p>
      </form>
      {isError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Kunde inte läsa tidigare inbjudningar.
        </p>
      )}
      {data
        ?.filter(
          (i) =>
            i.school_id === schoolId &&
            i.member_type === memberType &&
            !i.accepted_at &&
            !i.revoked_at &&
            new Date(i.expires_at) > new Date(),
        )
        .map((i) => (
          <div
            key={i.id}
            className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span>{i.email} · väntar på acceptans</span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await revoke({ data: { id: i.id } });
                  await qc.invalidateQueries({ queryKey: ["school-invitations"] });
                } catch {
                  toast.error("Kunde inte återkalla inbjudan");
                }
              }}
            >
              Återkalla
            </Button>
          </div>
        ))}
    </div>
  );
}
