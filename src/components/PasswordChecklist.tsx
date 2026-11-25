import { Check, Circle } from "lucide-react";
import { passwordRequirements } from "@/lib/password";

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <div className="rounded-panel border border-border bg-muted/40 p-3 text-sm">
      <p className="font-semibold">Lösenordet ska innehålla:</p>
      <ul className="mt-2 grid gap-1.5" aria-live="polite">
        {passwordRequirements.map((requirement) => {
          const met = requirement.test(password);
          return (
            <li
              key={requirement.id}
              className={`flex items-center gap-2 ${met ? "text-success" : "text-muted-foreground"}`}
            >
              {met ? (
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>{requirement.label}</span>
              <span className="sr-only">{met ? "– uppfyllt" : "– inte uppfyllt"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
