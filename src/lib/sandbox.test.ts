import { describe, expect, it } from "vitest";
import { isSandbox } from "./sandbox";

describe("isSandbox", () => {
  it("blocks delivery when the substitute is a test account", () => {
    expect(isSandbox(true, false)).toBe(true);
  });
  it("blocks delivery when the school is a test school", () => {
    expect(isSandbox(false, true)).toBe(true);
  });
  it("delivers normally when both are real", () => {
    expect(isSandbox(false, false)).toBe(false);
    expect(isSandbox(null, undefined)).toBe(false);
  });
});
