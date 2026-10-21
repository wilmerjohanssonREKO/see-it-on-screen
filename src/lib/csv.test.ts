import { it } from "node:test";
import assert from "node:assert/strict";
import { csvCell } from "./csv";

it("neutraliserar formler i exporterade användarfält", () => {
  for (const value of ["=1+1", "+SUM(A1)", "@SUM(A1)", "-1+1", " \t=1+1"]) {
    assert.equal(csvCell(value), `'${value}`);
  }
});
it("behåller numeriska värden och skyddar avgränsare", () => {
  assert.equal(csvCell(-5), "-5");
  assert.equal(csvCell('a;"b"'), '"a;""b"""');
  assert.equal(csvCell(null), "");
});