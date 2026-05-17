/**
 * Per-business serial queue. Only one applyEdit runs at a time per business —
 * if the owner talks faster than edits land, instructions queue in order.
 */
const tails = new Map<string, Promise<unknown>>();

export function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const next = prev.then(task, task);
  // Keep the chain alive even if a task rejects.
  tails.set(key, next.catch(() => undefined));
  return next;
}
