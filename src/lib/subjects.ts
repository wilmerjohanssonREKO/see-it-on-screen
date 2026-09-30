export const SUBJECTS = [
  "Svenska",
  "Engelska",
  "Matematik",
  "Fysik",
  "Kemi",
  "Biologi",
  "Naturkunskap",
  "Historia",
  "Religionskunskap",
  "Samhällskunskap",
  "Psykologi",
  "Idrott och hälsa",
  "Bild",
  "Musik",
  "Moderna språk",
  "Teknik",
  "Företagsekonomi",
  "Programmering",
] as const;

export const BACKGROUND_LABELS: Record<string, string> = {
  pending: "Väntar granskning",
  approved: "Godkänd",
  needs_renewal: "Behöver förnyas",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "Öppet",
  filled: "Tillsatt",
  expired: "Utgånget",
};

export function formatTime(t: string | null | undefined) {
  if (!t) return "";
  return t.slice(0, 5);
}
