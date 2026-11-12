import { it } from "node:test";
import assert from "node:assert/strict";
import { pagedCsv } from "./csv-pages";

it("exports all keyset pages and escapes user input", async () => {
  const rows = [
    { at: "3", id: "c", value: "=1+1" },
    { at: "2", id: "b", value: "hello" },
    { at: "1", id: "a", value: "end" },
  ];
  const result = await pagedCsv(
    ["value"],
    async (cursor) => (cursor ? rows.slice(2) : rows.slice(0, 2)),
    (r) => r,
    (r) => [r.value],
    2,
  );
  assert.equal(result, "value\n'=1+1\nhello\nend");
});
it("fails instead of returning an oversized partial export", async () => {
  await assert.rejects(
    pagedCsv(
      ["id"],
      async () => [
        { at: "3", id: "c" },
        { at: "2", id: "b" },
      ],
      (r) => r,
      (r) => [r.id],
      2,
      1,
    ),
    /för stor/,
  );
});
it("rejects a stuck pagination cursor", async () => {
  await assert.rejects(
    pagedCsv(
      ["id"],
      async () => [{ at: "3", id: "c" }],
      (r) => r,
      (r) => [r.id],
      1,
    ),
    /sidindelas/,
  );
});
