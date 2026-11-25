import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { passwordRequirements, strongPasswordSchema } from "./password";

describe("Starka lösenord", () => {
  test("godkänner ett lösenord som uppfyller samtliga synliga krav", () => {
    assert.equal(strongPasswordSchema.safeParse("RekoTest2026!").success, true);
  });

  test("kräver 8–72 tecken", () => {
    assert.equal(strongPasswordSchema.safeParse("Reko1!").success, false);
    assert.equal(strongPasswordSchema.safeParse(`${"A".repeat(70)}a1!`).success, false);
  });

  test("kräver stor och liten bokstav", () => {
    assert.equal(strongPasswordSchema.safeParse("rekotest2026!").success, false);
    assert.equal(strongPasswordSchema.safeParse("REKOTEST2026!").success, false);
  });

  test("kräver minst en siffra", () => {
    assert.equal(strongPasswordSchema.safeParse("RekoTest!").success, false);
  });

  test("kräver minst ett specialtecken och räknar inte blanksteg som specialtecken", () => {
    assert.equal(strongPasswordSchema.safeParse("RekoTest2026").success, false);
    assert.equal(strongPasswordSchema.safeParse("Reko Test 2026").success, false);
  });

  test("checklistan och valideringen har samma fyra krav", () => {
    assert.deepEqual(
      passwordRequirements.map((requirement) => requirement.id),
      ["length", "case", "number", "symbol"],
    );
    for (const requirement of passwordRequirements) {
      assert.equal(requirement.test("RekoTest2026!"), true);
    }
  });
});
