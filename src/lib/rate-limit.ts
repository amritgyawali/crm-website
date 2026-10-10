// Simple in-memory limiter for sign-in attempts (single office server).
const WINDOW = 15 * 60 * 1000;
const MAX = 5;
const hits = new Map<string, number[]>();

export function tooManyAttempts(key: string) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW);
  hits.set(key, list);
  if (list.length < MAX) return 0;
  return Math.ceil((WINDOW - (now - list[0]!)) / 60000);
}
export function recordFailure(key: string) {
  hits.set(key, [...(hits.get(key) ?? []), Date.now()]);
}
export function clearFailures(key: string) {
  hits.delete(key);
}
