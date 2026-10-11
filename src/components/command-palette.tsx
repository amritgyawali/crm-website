"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "./ui";
import { readRecent, type RecentItem } from "./recent";

type Item = { group: string; title: string; detail?: string; href: string; keywords?: string };

/**
 * Ctrl+K / Cmd+K: one box to find any candidate, partner, job order, campaign or receipt,
 * or jump to a page. Arrow keys move, Enter opens.
 */
export function CommandPalette({ pages }: { pages: { label: string; href: string; keywords?: string }[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [enterPending, setEnterPending] = useState(false);
  const [searched, setSearched] = useState(""); // the query the current hits belong to
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setEnterPending(false);
      setRecent(readRecent());
      setQ("");
      setHits([]);
      setActive(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      setLoading(false);
      setSearched(q.trim());
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        if (r.ok) setHits((await r.json()).hits);
        setSearched(q.trim());
        setLoading(false);
      } catch {
        /* aborted by a newer keystroke: that search will finish the job */
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const items: Item[] = useMemo(() => {
    const t = q.trim().toLowerCase();
    const pageHits = pages
      .filter((p) => !t || p.label.toLowerCase().includes(t) || p.keywords?.toLowerCase().includes(t))
      .slice(0, t ? 6 : 12)
      .map((p) => ({ group: "Go to", title: p.label, href: p.href }));
    const recents = t ? [] : recent.map((r) => ({ group: "Recently opened", title: r.title, detail: r.detail, href: r.href }));
    return [...recents, ...hits, ...pageHits];
  }, [hits, pages, q, recent]);

  const go = (it?: Item) => {
    if (!it) return;
    setOpen(false);
    router.push(it.href);
  };

  useEffect(() => setActive(0), [items.length]);
  useEffect(() => {
    if (enterPending && searched === q.trim()) {
      setEnterPending(false);
      if (items[0]) go(items[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterPending, searched]);

  if (!open) return null;
  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-50 bg-ink/30 flex items-start justify-center pt-[12vh] px-4" onMouseDown={() => setOpen(false)}>
      <div role="dialog" aria-label="Search everything" className="w-full max-w-[620px] bg-sheet border border-rule-2 rounded-[4px] shadow-[0_18px_50px_rgba(0,0,0,.18)] overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b border-rule px-4">
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") {
                e.preventDefault();
                // results for what was typed aren't in yet: open the first one when they arrive
                if (q.trim().length >= 2 && searched !== q.trim()) setEnterPending(true);
                else go(items[active]);
              }
            }}
            placeholder="Name, phone, passport, receipt no., job ref, partner, or a page"
            className="flex-1 h-12 bg-transparent outline-none text-[15px]"
            aria-label="Search"
          />
          <span className="text-[11.5px] text-muted">{loading ? "searching…" : "Esc to close"}</span>
        </div>
        <ul className="max-h-[56vh] overflow-y-auto py-1" role="listbox">
          {items.length === 0 && <li className="px-4 py-6 text-[13px] text-muted">{q.trim().length < 2 ? "Type at least two letters." : loading ? "Searching…" : "Nothing found."}</li>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <li key={it.group + it.href + i}>
                {head && <div className="label-caps px-4 pt-2.5 pb-1 text-[10.5px]">{head}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(it)}
                  className={cx("w-full text-left px-4 py-2 flex items-baseline justify-between gap-3", i === active ? "bg-ink text-paper" : "")}
                >
                  <span className="text-[13.5px] font-medium truncate">{it.title}</span>
                  {it.detail && <span className={cx("text-[12px] truncate", i === active ? "text-paper/70" : "text-muted")}>{it.detail}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-rule px-4 py-2 text-[11.5px] text-muted flex gap-4">
          <span>↑ ↓ move</span><span>Enter open</span><span>Ctrl K toggle</span>
        </div>
      </div>
    </div>
  );
}

export function PaletteButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("open-palette"))} className={className}>
      Search everything <kbd className="num text-[11px] border border-rule-2 rounded-[2px] px-1 ml-1">Ctrl K</kbd>
    </button>
  );
}
