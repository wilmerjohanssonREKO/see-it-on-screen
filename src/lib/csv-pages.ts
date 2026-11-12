import { csvCell } from "./csv";

/** Bound memory and fail explicitly, rather than exporting an incomplete file. */
export async function pagedCsv<Row>(
  headers: string[],
  fetch: (cursor: { at: string; id: string } | null) => Promise<Row[]>,
  key: (row: Row) => { at: string; id: string },
  cells: (row: Row) => unknown[],
  pageSize = 500,
  maxRows = 100_000,
): Promise<string> {
  const lines = [headers.join(";")];
  let cursor: { at: string; id: string } | null = null;
  let count = 0;
  for (;;) {
    const rows = await fetch(cursor);
    if (count + rows.length > maxRows)
      throw new Error("Exporten är för stor. Begränsa perioden innan du exporterar.");
    for (const row of rows) lines.push(cells(row).map(csvCell).join(";"));
    count += rows.length;
    if (rows.length < pageSize) return lines.join("\n");
    const next = key(rows[rows.length - 1]!);
    if (next.at === cursor?.at && next.id === cursor?.id)
      throw new Error("Exporten kunde inte sidindelas säkert.");
    cursor = next;
  }
}
