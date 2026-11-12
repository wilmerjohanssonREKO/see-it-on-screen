import { it } from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { clearPrivateCache, identityChanged } from "./auth-cache";

it("account changes clear private data and prevent late responses restoring it", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["school-assignments", "school-A"], [{ phone: "private" }]);
  let finish!: (value: string) => void;
  const pending = client.fetchQuery({ queryKey: ["old-account"], queryFn: () => new Promise<string>(resolve => { finish = resolve; }) });
  const cancelled = pending.catch(() => undefined);
  clearPrivateCache(client);
  finish("old result");
  await cancelled;
  assert.equal(client.getQueryCache().getAll().length, 0);
});

it("token refresh preserves identity, signout and cross-account sign-in do not", () => {
  assert.equal(identityChanged("a", "a"), false);
  assert.equal(identityChanged(undefined, "a"), false);
  assert.equal(identityChanged("a", null), true);
  assert.equal(identityChanged("a", "b"), true);
});
