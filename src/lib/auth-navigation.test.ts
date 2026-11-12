import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { authDestination, invitationToken } from "./auth-navigation";
describe("auth navigation and invitation input", () => {
  it("allows only fixed local destinations", () => {
    assert.equal(authDestination("invite"), "/inbjudan");
    assert.equal(authDestination("recovery"), "/aterstall-losenord");
    for (const value of ["https://evil.example", "//evil.example", "/admin", null])
      assert.equal(authDestination(value), null);
  });
  it("accepts only 256-bit hex invitation tokens", () => {
    assert.equal(invitationToken("a".repeat(64)), "a".repeat(64));
    for (const value of [null, "a".repeat(63), "A".repeat(64), "../token"])
      assert.equal(invitationToken(value), null);
  });
});
