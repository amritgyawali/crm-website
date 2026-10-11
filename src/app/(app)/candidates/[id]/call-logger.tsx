"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import type { ActionState } from "@/lib/action";
import { CALL_OUTCOMES, type CallOutcome } from "@/lib/constants";
import { btn, cx } from "@/components/ui";
import { toast } from "@/lib/toast";

const DEFAULT_NEXT: Partial<Record<CallOutcome, number>> = {
  NO_ANSWER: 1, CALL_BACK: 1, INTERESTED: 2, ENROLLED: 7, PAYMENT_PROMISED: 3,
};
const NEXT_CHOICES = [
  { days: 0, label: "None" },
  { days: 1, label: "Tomorrow" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
];

/**
 * Built for speed: tap an outcome, tap Save. The next-call date is
 * pre-picked from the outcome and can be changed with one tap.
 */
export function CallLogger({ action, compact }: { action: (fd: FormData) => Promise<ActionState>; compact?: boolean }) {
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [nextIn, setNextIn] = useState<number | "date">(0);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<"PHONE" | "WHATSAPP">("PHONE");
  const [promised, setPromised] = useState({ date: "", amount: "" });
  const [msg, setMsg] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function choose(o: CallOutcome) {
    setOutcome(o);
    setMsg(null);
    setNextIn(DEFAULT_NEXT[o] ?? 0);
  }

  function save() {
    if (!outcome) return;
    const fd = new FormData();
    fd.set("outcome", outcome);
    fd.set("note", note);
    fd.set("channel", channel);
    if (nextIn === "date") fd.set("nextCallAt", date);
    else if (nextIn) fd.set("nextIn", String(nextIn));
    if (outcome === "PAYMENT_PROMISED") {
      fd.set("promisedDate", promised.date);
      fd.set("promisedAmount", promised.amount);
    }
    start(async () => {
      const r = await action(fd);
      setMsg(r?.ok ? null : r);
      if (r?.ok) {
        toast(r.message ?? "Call saved.");
        setOutcome("");
        setNote("");
        setNextIn(0);
        setPromised({ date: "", amount: "" });
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="flex gap-1 mb-2.5 text-[12px]">
        {(["PHONE", "WHATSAPP"] as const).map((c) => (
          <button key={c} type="button" onClick={() => setChannel(c)} className={cx("px-2 py-0.5 rounded-[2px] border", channel === c ? "border-ink bg-ink text-paper" : "border-rule-2 text-muted")}>
            {c === "PHONE" ? "Phone call" : "WhatsApp"}
          </button>
        ))}
      </div>
      <div className={cx("grid gap-1.5", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
        {CALL_OUTCOMES.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            className={cx(
              "text-left px-2.5 py-2 text-[13px] border rounded-[3px] leading-tight",
              outcome === o.value ? "border-ink bg-ink text-paper font-medium" : "border-rule-2 bg-field hover:border-ink-2",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {outcome && (
        <div className="mt-3 space-y-2.5">
          {outcome === "PAYMENT_PROMISED" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[12px] text-muted">Promised date
                <input type="date" className="control mt-0.5" value={promised.date} onChange={(e) => setPromised((p) => ({ ...p, date: e.target.value }))} />
              </label>
              <label className="text-[12px] text-muted">Amount
                <input inputMode="decimal" className="control mt-0.5 num" value={promised.amount} onChange={(e) => setPromised((p) => ({ ...p, amount: e.target.value }))} />
              </label>
            </div>
          )}
          <input
            className="control"
            placeholder="Short note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}
            autoFocus
          />
          <div>
            <div className="text-[12px] text-muted mb-1">Next call</div>
            <div className="flex flex-wrap gap-1">
              {NEXT_CHOICES.map((n) => (
                <button key={n.days} type="button" onClick={() => setNextIn(n.days)} className={cx("px-2 py-1 text-[12.5px] border rounded-[2px]", nextIn === n.days ? "border-accent bg-accent-tint text-accent font-medium" : "border-rule-2")}>
                  {n.label}
                </button>
              ))}
              <button type="button" onClick={() => setNextIn("date")} className={cx("px-2 py-1 text-[12.5px] border rounded-[2px]", nextIn === "date" ? "border-accent bg-accent-tint text-accent font-medium" : "border-rule-2")}>
                Pick date
              </button>
            </div>
            {nextIn === "date" && (
              <input type="datetime-local" className="control mt-1.5" value={date} min={format(new Date(), "yyyy-MM-dd'T'HH:mm")} onChange={(e) => setDate(e.target.value)} />
            )}
            {typeof nextIn === "number" && nextIn > 0 && (
              <div className="text-[12px] text-muted mt-1">{format(addDays(new Date(), nextIn), "EEEE d MMM")}</div>
            )}
          </div>
          <button type="button" disabled={pending} onClick={save} className={cx(btn("primary"), "w-full")}>
            {pending ? "Saving…" : "Save call"}
          </button>
        </div>
      )}
      {msg && (msg.error || msg.message) && (
        <p className={cx("mt-2 text-[12.5px]", msg.error ? "text-danger" : "text-accent")}>{msg.error ?? msg.message}</p>
      )}
    </div>
  );
}
