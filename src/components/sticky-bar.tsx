"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * A slim bar that slides in once the page header has scrolled away, keeping the record's
 * name, key figures, quick actions and section jumps in reach on long pages.
 */
export function StickyBar({
  title, sub, figures, actions, sections,
}: {
  title: string;
  sub?: ReactNode;
  figures?: { label: string; value: string; tone?: "red" | "green" }[];
  actions?: ReactNode;
  sections: { id: string; label: string }[];
}) {
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setCurrent(vis.target.id);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      obs.disconnect();
    };
  }, [sections]);

  return (
    <div
      aria-hidden={!show}
      className={cx(
        "no-print fixed z-20 left-0 right-0 top-12 lg:top-14 lg:left-[228px] bg-sheet/95 backdrop-blur-[3px] border-b border-rule transition-[transform,opacity] duration-150",
        show ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none",
      )}
    >
      <div className="max-w-[1400px] px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-4">
        <div className="min-w-0 shrink">
          <div className="font-serif font-semibold text-[15px] leading-tight truncate">{title}</div>
          {sub && <div className="text-[11.5px] text-muted truncate">{sub}</div>}
        </div>
        {figures && (
          <dl className="hidden md:flex items-center gap-4 text-[12px]">
            {figures.map((f) => (
              <div key={f.label} className="flex items-baseline gap-1.5">
                <dt className="text-muted">{f.label}</dt>
                <dd className={cx("num font-medium", f.tone === "red" && "text-danger", f.tone === "green" && "text-accent")}>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <nav className="hidden xl:flex items-center gap-0.5 ml-auto text-[12.5px]" aria-label="Sections">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={cx("px-2 py-1 rounded-[2px] no-underline", current === s.id ? "bg-well text-ink font-medium" : "text-muted hover:text-ink")}>
              {s.label}
            </a>
          ))}
        </nav>
        {actions && <div className="flex items-center gap-1.5 ml-auto xl:ml-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
