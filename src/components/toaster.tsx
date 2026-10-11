"use client";

import { useEffect, useState } from "react";
import type { ToastTone } from "@/lib/toast";
import { cx } from "./ui";

type T = { id: number; text: string; tone: ToastTone };

/** Bottom-right confirmations ("Payment saved", "Call saved"). Errors stay until closed. */
export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { text, tone } = (e as CustomEvent<{ text: string; tone: ToastTone }>).detail;
      const id = ++n + Date.now();
      setItems((xs) => [...xs.slice(-3), { id, text, tone }]);
      if (tone !== "error") setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4200);
    };
    window.addEventListener("app-toast", on);
    return () => window.removeEventListener("app-toast", on);
  }, []);
  return (
    <div className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto sm:w-[360px] flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          data-toast={t.tone}
          className={cx(
            "pointer-events-auto flex items-start gap-3 px-3.5 py-2.5 rounded-[3px] border shadow-[0_8px_24px_rgba(0,0,0,.14)] text-[13px] animate-[toast-in_.18s_ease-out]",
            t.tone === "error" ? "bg-danger-tint text-danger border-danger/30" : "bg-ink text-paper border-ink",
          )}
        >
          <span className={cx("mt-1 w-1.5 h-1.5 rounded-full shrink-0", t.tone === "error" ? "bg-danger" : t.tone === "info" ? "bg-paper/60" : "bg-chart-a")} />
          <span className="flex-1 whitespace-pre-line">{t.text}</span>
          <button type="button" aria-label="Dismiss" className="opacity-60 hover:opacity-100 leading-none" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
