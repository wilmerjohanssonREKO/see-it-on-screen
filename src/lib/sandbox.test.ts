import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSandbox } from "./sandbox";

describe("isSandbox", () => {
  it("blocks delivery when the substitute is a test account", () => {
    assert.equal(isSandbox(true, false), true);
  });
  it("blocks delivery when the school is a test school", () => {
    assert.equal(isSandbox(false, true), true);
  });
  it("delivers normally when both are real", () => {
    assert.equal(isSandbox(false, false), false);
    assert.equal(isSandbox(null, undefined), false);
  });
});
