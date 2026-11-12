/** Microtask batching with isolated scopes and no persistent value cache. */
export function createScopedBatchLoader<T>(maxBatchSize = 100) {
  type Pending = { resolve: (value: T | null) => void; reject: (error: unknown) => void };
  const queues = new Map<
    string,
    { fetch: (ids: string[]) => Promise<Record<string, T | null>>; ids: Map<string, Pending[]> }
  >();
  return (scope: string, id: string, fetch: (ids: string[]) => Promise<Record<string, T | null>>) =>
    new Promise<T | null>((resolve, reject) => {
      let queue = queues.get(scope);
      if (!queue) {
        queue = { fetch, ids: new Map() };
        queues.set(scope, queue);
        queueMicrotask(async () => {
          const batch = queues.get(scope);
          queues.delete(scope);
          if (!batch) return;
          const ids = [...batch.ids.keys()];
          for (let offset = 0; offset < ids.length; offset += maxBatchSize) {
            const part = ids.slice(offset, offset + maxBatchSize);
            try {
              const values = await batch.fetch(part);
              for (const key of part)
                for (const pending of batch.ids.get(key) ?? [])
                  pending.resolve(values[key] ?? null);
            } catch (error) {
              for (const key of part)
                for (const pending of batch.ids.get(key) ?? []) pending.reject(error);
            }
          }
        });
      }
      const waiting = queue.ids.get(id) ?? [];
      waiting.push({ resolve, reject });
      queue.ids.set(id, waiting);
    });
}

export async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await map(items[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(items.length, Math.max(1, concurrency)) }, worker),
  );
  return results;
}
