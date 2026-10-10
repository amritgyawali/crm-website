"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export type BellGroup = { key: string; title: string; count: number; items: { id: string; title: string; detail: string; href: string; tone: string }[] };

/** Top-bar reminders: total count, and a dropdown with the first few of each kind. */
export function ReminderBell({ groups }: { groups: BellGroup[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const total = groups.reduce((s, g) => s + g.count, 0);
  const urgent = groups.some((g) => g.items.some((i) => i.tone === "danger"));
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${total} reminders`}
        className={cx("inline-flex items-center gap-1.5 h-8 px-2 rounded-[3px] border text-[13px]", open ? "border-ink-2 bg-field" : "border-transparent hover:border-rule-2")}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
          <path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1.2 1.2H2.8L4 11.5ZM6.5 14a1.6 1.6 0 0 0 3 0" />
        </svg>
        {total > 0 && <span className={cx("num text-[11.5px] px-1.5 rounded-[2px]", urgent ? "bg-danger text-sheet" : "bg-well text-ink-2")}>{total}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-[380px] max-w-[calc(100vw-2rem)] bg-sheet border border-rule-2 rounded-[3px] shadow-[0_14px_40px_rgba(0,0,0,.16)] z-40 animate-[pop-in_.14s_ease-out]">
          <div className="flex items-center justify-between px-4 h-10 border-b border-rule">
            <span className="text-[13px] font-semibold">Reminders</span>
            <Link href="/alerts" className="link text-[12.5px]">See all</Link>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {total === 0 && <p className="px-4 py-6 text-[13px] text-muted">Nothing needs attention.</p>}
            {groups.filter((g) => g.count).map((g) => (
              <section key={g.key} className="border-b border-rule last:border-b-0">
                <div className="flex justify-between px-4 pt-2.5 pb-1">
                  <span className="label-caps text-[10.5px]">{g.title}</span>
                  <span className="num text-[11.5px] text-muted">{g.count}</span>
                </div>
                <ul>
                  {g.items.map((i) => (
                    <li key={i.id}>
                      <Link href={i.href} className="flex gap-2.5 px-4 py-1.5 no-underline hover:bg-hover">
                        <span className={cx("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", i.tone === "danger" ? "bg-danger" : i.tone === "warn" ? "bg-warn" : "bg-rule-2")} />
                        <span className="min-w-0">
                          <span className="block text-[13px] truncate">{i.title}</span>
                          <span className={cx("block text-[12px] truncate", i.tone === "danger" ? "text-danger" : "text-muted")}>{i.detail}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {g.count > g.items.length && <Link href="/alerts" className="block px-4 pb-2 text-[12px] text-muted no-underline hover:underline">+{g.count - g.items.length} more</Link>}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
