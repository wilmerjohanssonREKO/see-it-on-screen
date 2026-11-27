import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { experienceScore, normalizePath, type PageStats } from "./behaviour-score";

const base: PageStats = {
  path: "/", views: 100, avg_scroll: 100, avg_seconds: 30, clicks: 200, rage_clicks: 0,
  dead_clicks: 0, form_abandons: 0, form_submits: 0, no_click_share: 0, exits: 0, entries: 100,
};

describe("Upplevelsepoäng", () => {
  test("en sida utan problem får 100 och ingen svaghet", () => {
    assert.deepEqual(experienceScore(base), { score: 100, weakness: null });
  });
  test("frustrerade klick blir största svagheten", () => {
    const r = experienceScore({ ...base, rage_clicks: 20 });
    assert.equal(r.weakness, "rage");
    assert.equal(r.score, 80);
  });
  test("övergivna formulär sänker poängen", () => {
    const r = experienceScore({ ...base, form_abandons: 3, form_submits: 1 });
    assert.equal(r.weakness, "forms");
    assert.equal(r.score, 85);
  });
});

describe("Sökvägar", () => {
  test("id:n i adressen sparas aldrig", () => {
    assert.equal(normalizePath("/uppdrag/32c888b0-1234-4abc-9def-0123456789ab"), "/uppdrag/:id");
    assert.equal(normalizePath("/kontakt"), "/kontakt");
  });
});
