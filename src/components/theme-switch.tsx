"use client";

import { useEffect, useState } from "react";
import { cx } from "./ui";

type Mode = "system" | "light" | "dark";
const LABEL: Record<Mode, string> = { system: "Auto", light: "Day", dark: "Night" };

/** Day / Night / Auto. Saved in a cookie so the server renders the right theme with no flash. */
export function ThemeSwitch({ initial, className }: { initial: Mode; className?: string }) {
  const [mode, setMode] = useState<Mode>(initial);
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "system") delete root.dataset.theme;
    else root.dataset.theme = mode;
    document.cookie = `theme=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [mode]);
  return (
    <div role="radiogroup" aria-label="Colour theme" className={cx("inline-flex border border-rule-2 rounded-[3px] overflow-hidden text-[11.5px]", className)}>
      {(["light", "dark", "system"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => setMode(m)}
          className={cx("px-2 h-6 border-r border-rule-2 last:border-r-0", mode === m ? "bg-ink text-paper" : "text-muted hover:text-ink")}
        >
          {LABEL[m]}
        </button>
      ))}
    </div>
  );
}
