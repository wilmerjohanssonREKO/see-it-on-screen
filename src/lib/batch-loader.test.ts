import { it } from "node:test";
import assert from "node:assert/strict";
import { createScopedBatchLoader, mapConcurrent } from "./batch-loader";

it("batches and deduplicates IDs, isolates viewer identities", async () => {
  const load = createScopedBatchLoader<string>(2);
  const calls: string[][] = [];
  const fetch = async (ids: string[]) => {
    calls.push(ids);
    return Object.fromEntries(ids.map((id) => [id, `A:${id}`]));
  };
  const values = await Promise.all([
    load("A", "one", fetch),
    load("A", "one", fetch),
    load("A", "two", fetch),
    load("A", "three", fetch),
    load("B", "one", async () => ({ one: "B:one" })),
  ]);
  assert.deepEqual(values, ["A:one", "A:one", "A:two", "A:three", "B:one"]);
  assert.deepEqual(calls, [["one", "two"], ["three"]]);
});

it("failed batches reject callers and do not poison later loads", async () => {
  const load = createScopedBatchLoader<string>();
  await assert.rejects(
    load("A", "one", async () => {
      throw new Error("failed");
    }),
  );
  assert.equal(await load("A", "one", async () => ({ one: "ok" })), "ok");
});

it("bounded concurrency preserves order without serializing all work", async () => {
  let running = 0,
    maximum = 0;
  const result = await mapConcurrent([1, 2, 3, 4, 5], 2, async (n) => {
    running++;
    maximum = Math.max(maximum, running);
    await new Promise((resolve) => setTimeout(resolve, 1));
    running--;
    return n * 2;
  });
  assert.deepEqual(result, [2, 4, 6, 8, 10]);
  assert.equal(maximum, 2);
});
