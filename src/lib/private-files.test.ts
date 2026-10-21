import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isOwnedPrivatePath } from "./private-files";

describe("Privata filer tillhör profilens ägare", () => {
  const owner = "11111111-1111-4111-8111-111111111111";
  it("tillåter ägarens CV och bild", () => {
    assert.equal(isOwnedPrivatePath(`${owner}/123-cv.pdf`, owner), true);
    assert.equal(isOwnedPrivatePath(`${owner}/123-avatar.png`, owner), true);
  });
  it("blockerar en annan vikaries filer", () => {
    assert.equal(isOwnedPrivatePath("22222222-2222-4222-8222-222222222222/cv.pdf", owner), false);
  });
  it("blockerar sökvägar som lämnar ägarens mapp", () => {
    for (const path of [`${owner}/../cv.pdf`, `${owner}/..`, `${owner}/`, `${owner}/nested/cv.pdf`, `${owner}/..\\cv.pdf`]) {
      assert.equal(isOwnedPrivatePath(path, owner), false);
    }
  });
});