"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { cx } from "./ui";

/** GET form that submits as soon as a select changes. On phones it folds away behind a "Filters" button. */
export function FilterForm({ children, action }: { children: ReactNode; action?: string }) {
  const sp = useSearchParams();
  const active = [...sp.keys()].filter((k) => !["page", "view", "sort", "mine"].includes(k)).length;
  const [open, setOpen] = useState(active > 0);
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="md:hidden inline-flex items-center gap-2 h-8 px-3 mb-2 border border-rule-2 rounded-[3px] text-[13px] bg-field"
      >
        Filters{active > 0 && <span className="num text-[11.5px] bg-ink text-paper px-1.5 rounded-[2px]">{active}</span>}
        <span className="text-muted text-[11px]">{open ? "▴" : "▾"}</span>
      </button>
      <form
        action={action}
        className={cx("flex-wrap items-end gap-2", open ? "flex" : "hidden md:flex")}
        onChange={(e) => {
          const t = e.target as HTMLElement;
          if (t.tagName === "SELECT" || (t as HTMLInputElement).type === "date" || (t as HTMLInputElement).type === "month") (e.currentTarget as HTMLFormElement).requestSubmit();
        }}
      >
        {children}
      </form>
    </div>
  );
}
