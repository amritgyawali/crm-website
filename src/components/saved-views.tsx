"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cx } from "./ui";

type View = { name: string; qs: string };

/** Lets each person save the filters they use often ("My Poland files", "Overdue, Imran"). Kept on this device. */
export function SavedViews({ storageKey }: { storageKey: string }) {
  const path = usePathname();
  const sp = useSearchParams();
  const [views, setViews] = useState<View[]>([]);
  const key = `crm-views:${storageKey}`;
  const qs = new URLSearchParams([...sp.entries()].filter(([k]) => k !== "page")).toString();

  useEffect(() => {
    try {
      setViews(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      setViews([]);
    }
  }, [key]);
  const save = (vs: View[]) => {
    setViews(vs);
    try {
      localStorage.setItem(key, JSON.stringify(vs));
    } catch {
      /* storage blocked */
    }
  };
  if (!views.length && !qs) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[12.5px]">
      {views.length > 0 && <span className="label-caps text-[10.5px] mr-1">Saved</span>}
      {views.map((v) => (
        <span key={v.name} className={cx("inline-flex items-center h-7 border rounded-[3px]", v.qs === qs ? "border-ink bg-ink text-paper" : "border-rule-2 bg-field")}>
          <Link href={`${path}?${v.qs}`} className="px-2.5 no-underline">{v.name}</Link>
          <button type="button" aria-label={`Remove ${v.name}`} className="px-1.5 opacity-60 hover:opacity-100" onClick={() => save(views.filter((x) => x.name !== v.name))}>×</button>
        </span>
      ))}
      {qs && !views.some((v) => v.qs === qs) && (
        <button
          type="button"
          className="h-7 px-2.5 border border-dashed border-rule-2 rounded-[3px] text-muted hover:text-ink hover:border-ink-2"
          onClick={() => {
            const name = window.prompt("Name this view")?.trim();
            if (name) save([...views.filter((x) => x.name !== name), { name, qs }]);
          }}
        >
          + Save this view
        </button>
      )}
    </div>
  );
}
