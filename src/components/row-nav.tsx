"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Keyboard use for a list: j / k (or ↓ ↑ once a row is picked) move, Enter opens,
 * x ticks the row's checkbox, Esc lets go. One per page.
 */
export function RowNav({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    let i = -1;
    const rows = () => Array.from(box.current?.querySelectorAll<HTMLTableRowElement>("tbody tr") ?? []).filter((r) => r.offsetParent !== null);
    const mark = (n: number) => {
      const rs = rows();
      rs.forEach((r) => r.removeAttribute("data-active"));
      if (n < 0 || !rs.length) return (i = -1);
      i = Math.max(0, Math.min(n, rs.length - 1));
      rs[i]!.setAttribute("data-active", "");
      rs[i]!.scrollIntoView({ block: "nearest" });
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (document.querySelector("[role=dialog]")) return;
      const k = e.key;
      if (k === "j" || (k === "ArrowDown" && i >= 0)) { e.preventDefault(); mark(i + 1); }
      else if (k === "k" || (k === "ArrowUp" && i >= 0)) { e.preventDefault(); mark(i - 1); }
      else if (k === "Enter" && i >= 0) {
        const a = rows()[i]?.querySelector<HTMLAnchorElement>("a.row-link, a[href]");
        if (a) { e.preventDefault(); router.push(a.getAttribute("href")!); }
      } else if (k === "x" && i >= 0) {
        const cb = rows()[i]?.querySelector<HTMLInputElement>("input[type=checkbox]");
        if (cb) { e.preventDefault(); cb.click(); }
      } else if (k === "Escape") mark(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);
  return <div ref={box}>{children}</div>;
}

export function KeyHint() {
  return (
    <span className="hidden lg:inline text-[11.5px] text-muted">
      <kbd className="num border border-rule-2 rounded-[2px] px-1">j</kbd> <kbd className="num border border-rule-2 rounded-[2px] px-1">k</kbd> move ·{" "}
      <kbd className="num border border-rule-2 rounded-[2px] px-1">Enter</kbd> open
    </span>
  );
}
