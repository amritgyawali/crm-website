"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "./ui";

export type NavItem = { href: string; label: string; count?: number; urgent?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };

export function Sidebar({ groups, company, footer }: { groups: NavGroup[]; company: string; footer: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  const nav = (
    <nav className="flex-1 overflow-y-auto py-3">
      {groups.map((g, i) => (
        <div key={i} className="mb-4">
          {g.label && <div className="label-caps px-5 mb-1 text-[10.5px]">{g.label}</div>}
          <ul>
            {g.items.map((it) => {
              const active = isActive(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={cx(
                      "flex items-center justify-between gap-2 pl-5 pr-4 py-[5px] no-underline text-[13.5px] border-l-[3px]",
                      active ? "border-ink bg-well font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink hover:bg-well/60",
                    )}
                  >
                    <span>{it.label}</span>
                    {!!it.count && (
                      <span className={cx("num text-[11.5px] px-1.5 rounded-[2px]", it.urgent ? "bg-danger text-white" : "text-muted")}>{it.count}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* mobile bar */}
      <div className="lg:hidden no-print sticky top-0 z-30 flex items-center justify-between h-12 px-4 bg-sheet border-b border-rule">
        <span className="font-serif font-semibold text-[16px] truncate">{company}</span>
        <span className="flex gap-2">
          <button type="button" onClick={() => window.dispatchEvent(new Event("open-palette"))} className="text-[13px] font-medium px-2 py-1 border border-rule-2 rounded-[3px]">
            Search
          </button>
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-[13px] font-medium px-2 py-1 border border-rule-2 rounded-[3px]" aria-expanded={open}>
            {open ? "Close" : "Menu"}
          </button>
        </span>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 top-12 z-20 bg-sheet flex flex-col">
          {nav}
          <div className="border-t border-rule p-4">{footer}</div>
        </div>
      )}

      {/* desktop */}
      <aside className="hidden lg:flex no-print flex-col w-[228px] shrink-0 h-screen sticky top-0 border-r border-rule bg-sheet">
        <div className="px-5 h-14 flex items-center border-b border-rule">
          <Link href="/" className="font-serif font-semibold text-[16.5px] leading-tight no-underline line-clamp-2">{company}</Link>
        </div>
        {nav}
        <div className="border-t border-rule px-5 py-3">{footer}</div>
      </aside>
    </>
  );
}
