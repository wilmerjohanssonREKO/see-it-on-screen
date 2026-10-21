export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  const text = typeof value === "string" && /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}