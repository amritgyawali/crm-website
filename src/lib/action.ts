import { unstable_rethrow } from "next/navigation";

export type ActionState = { ok?: boolean; error?: string; message?: string; at?: number } | null;

/** Runs a server action body and turns thrown errors into a message for the form. */
export async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { ok: true, message: message || undefined, at: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    const msg = e instanceof Error ? e.message : "Something went wrong";
    return { error: msg, at: Date.now() };
  }
}

// ---------- FormData readers

export function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}
export function optStr(fd: FormData, k: string) {
  return str(fd, k) || null;
}
export function need(fd: FormData, k: string, label: string) {
  const v = str(fd, k);
  if (!v) throw new Error(`${label} is required.`);
  return v;
}
export function amount(fd: FormData, k: string, label: string, opts: { min?: number; allowZero?: boolean } = {}) {
  const raw = str(fd, k).replace(/,/g, "");
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) throw new Error(`${label} must be a number.`);
  if (!opts.allowZero && n <= 0) throw new Error(`${label} must be more than zero.`);
  if (opts.min !== undefined && n < opts.min) throw new Error(`${label} must be at least ${opts.min}.`);
  return Math.round(n * 100) / 100;
}
export function optNum(fd: FormData, k: string) {
  const raw = str(fd, k).replace(/,/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
