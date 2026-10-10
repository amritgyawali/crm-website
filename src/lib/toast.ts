// Client-side helper: show a short confirmation in the corner. Safe to call from any client component.
export type ToastTone = "ok" | "error" | "info";

export function toast(text: string, tone: ToastTone = "ok") {
  if (typeof window === "undefined" || !text) return;
  window.dispatchEvent(new CustomEvent("app-toast", { detail: { text, tone } }));
}
