import { z } from "zod";

export const passwordRequirements = [
  {
    id: "length",
    label: "8–72 tecken",
    errorMessage: "Lösenordet måste vara 8–72 tecken långt",
    test: (password: string) => password.length >= 8 && password.length <= 72,
  },
  {
    id: "case",
    label: "Både stor och liten bokstav",
    errorMessage: "Lösenordet måste innehålla både stor och liten bokstav",
    test: (password: string) => /[a-zåäö]/.test(password) && /[A-ZÅÄÖ]/.test(password),
  },
  {
    id: "number",
    label: "Minst en siffra",
    errorMessage: "Lösenordet måste innehålla minst en siffra",
    test: (password: string) => /[0-9]/.test(password),
  },
  {
    id: "symbol",
    label: "Minst ett specialtecken",
    errorMessage: "Lösenordet måste innehålla minst ett specialtecken",
    test: (password: string) => /[^A-Za-zÅÄÖåäö0-9\s]/.test(password),
  },
] as const;

export function passwordValidationMessage(password: string): string | null {
  return passwordRequirements.find((requirement) => !requirement.test(password))?.errorMessage ?? null;
}

export function shouldShowPasswordChecklist(password: string): boolean {
  return password.length > 0 && passwordValidationMessage(password) !== null;
}

export const strongPasswordSchema = z
  .string()
  .min(8, "Lösenordet måste vara minst 8 tecken")
  .max(72, "Lösenordet får vara högst 72 tecken")
  .refine(
    (password) => passwordRequirements.every((requirement) => requirement.test(password)),
    "Lösenordet uppfyller inte alla krav i listan",
  );
