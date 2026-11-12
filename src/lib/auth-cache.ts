import type { QueryClient } from "@tanstack/react-query";

/** Clear immediately; cancelling prevents a late response from restoring old data. */
export function clearPrivateCache(client: QueryClient) {
  void client.cancelQueries();
  client.clear();
}

export function identityChanged(previous: string | null | undefined, next: string | null) {
  return previous !== undefined && previous !== next;
}
