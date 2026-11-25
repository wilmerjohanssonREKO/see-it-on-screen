import { z } from "zod";

export const passwordRequirements = [
  {
    id: "length",
    label: "8–72 tecken",
    test: (password: string) => password.length >= 8 && password.length <= 72,
  },
  {
    id: "case",
    label: "Både stor och liten bokstav",
    test: (password: string) => /[a-zåäö]/.test(password) && /[A-ZÅÄÖ]/.test(password),
  },
  {
    id: "number",
    label: "Minst en siffra",
    test: (password: string) => /[0-9]/.test(password),
  },
  {
    id: "symbol",
    label: "Minst ett specialtecken",
    test: (password: string) => /[^A-Za-zÅÄÖåäö0-9\s]/.test(password),
  },
] as const;

export const strongPasswordSchema = z
  .string()
  .min(8, "Lösenordet måste vara minst 8 tecken")
  .max(72, "Lösenordet får vara högst 72 tecken")
  .refine(
    (password) => passwordRequirements.every((requirement) => requirement.test(password)),
    "Lösenordet uppfyller inte alla krav i listan",
  );
