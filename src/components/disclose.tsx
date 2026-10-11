"use client";

import { useState, type ReactNode } from "react";

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Collapsible block for secondary forms. `open` only sets the starting state, so a refresh never snaps it shut. */
export function Disclose({ label, children, open, className }: { label: ReactNode; children: ReactNode; open?: boolean; className?: string }) {
  const [isOpen, setOpen] = useState(!!open);
  return (
    <details
      open={isOpen}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className={cx("group border border-rule rounded-[3px] bg-field", className)}
    >
      <summary className="list-none cursor-pointer select-none px-3 py-2 text-[13px] font-medium flex items-center justify-between [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <span className="text-muted text-[11px] group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-3 pb-3 pt-1 border-t border-rule">{children}</div>
    </details>
  );
}
