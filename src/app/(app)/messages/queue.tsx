"use client";

import { useState } from "react";
import Link from "next/link";
import { waLink } from "@/lib/format";
import { btn, cx } from "@/components/ui";
import { logMessage } from "./actions";

export type QueueItem = { id: string; name: string; phone: string; context: string; text: string; sentToday: boolean };

/**
 * WhatsApp has no free bulk-send, so this steps through the list: each press opens the chat
 * with the message written, logs it, and moves to the next person.
 */
export function SendQueue({ items, template }: { items: QueueItem[]; template: string | null }) {
  const [state, setState] = useState<Record<string, "sent" | "skipped">>({});
  const [current, setCurrent] = useState(() => Math.max(0, items.findIndex((i) => !i.sentToday)));
  const done = Object.values(state).filter((v) => v === "sent").length;
  const next = (from: number, s: Record<string, string>) => {
    const i = items.findIndex((it, j) => j > from && !s[it.id]);
    setCurrent(i === -1 ? items.length : i);
  };
  const send = (i: number) => {
    const it = items[i]!;
    window.open(waLink(it.phone, it.text), "_blank", "noopener");
    void logMessage(it.id, template, it.text);
    const s = { ...state, [it.id]: "sent" as const };
    setState(s);
    next(i, s);
  };
  const skip = (i: number) => {
    const s = { ...state, [items[i]!.id]: "skipped" as const };
    setState(s);
    next(i, s);
  };

  if (!items.length) return <p className="px-4 py-6 text-[13px] text-muted">Nobody in this list.</p>;
  return (
    <div>
      <div className="px-4 py-3 border-b border-rule flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px]"><span className="num font-medium">{done}</span> of <span className="num">{items.length}</span> sent this round</div>
        {current < items.length ? (
          <button type="button" className={btn("primary")} onClick={() => send(current)}>Open next: {items[current]!.name.split(" ")[0]}</button>
        ) : (
          <span className="text-[13px] text-accent font-medium">All done.</span>
        )}
      </div>
      <ul className="divide-y divide-rule">
        {items.map((it, i) => {
          const st = state[it.id];
          return (
            <li key={it.id} className={cx("px-4 py-3 grid gap-3 lg:grid-cols-[240px_1fr_auto] items-start", i === current && "bg-mark/40")}>
              <div className="min-w-0">
                <Link href={`/candidates/${it.id}`} className="row-link">{it.name}</Link>
                <div className="text-[12px] text-muted">{it.context}</div>
                {it.sentToday && !st && <div className="text-[12px] text-warn">Already sent this today</div>}
              </div>
              <p className="text-[12.5px] text-ink-2 whitespace-pre-line line-clamp-3">{it.text}</p>
              <div className="flex gap-1.5 justify-end">
                {st === "sent" ? <span className="text-[12.5px] text-accent font-medium">Sent</span> : st === "skipped" ? <span className="text-[12.5px] text-muted">Skipped</span> : (
                  <>
                    <button type="button" className={btn(i === current ? "primary" : "secondary", "sm")} onClick={() => send(i)}>Open WhatsApp</button>
                    <button type="button" className={btn("ghost", "sm")} onClick={() => skip(i)}>Skip</button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
