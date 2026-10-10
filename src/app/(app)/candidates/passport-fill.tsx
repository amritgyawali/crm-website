"use client";

import { useRef, useState, useTransition } from "react";
import { parseMrz, type PassportData } from "@/lib/mrz";
import { btn, cx } from "@/components/ui";
import { scanPassportPhoto } from "./passport-actions";

/** Fills the candidate form from a passport: paste the two machine-readable lines, or upload a photo. */
export function PassportFill({ photoEnabled }: { photoEnabled: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [mrz, setMrz] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function fill(d: PassportData, warnings: string[]) {
    const form = box.current?.closest("form");
    if (!form) return;
    const set = (name: string, value: string | null) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      if (el && value) {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    set("fullName", d.fullName);
    set("passportNo", d.passportNo);
    set("passportExpiry", d.expiry);
    set("dateOfBirth", d.dateOfBirth);
    set("nationality", d.nationality);
    set("gender", d.gender);
    const expiringSoon = d.expiry && new Date(d.expiry) < new Date(Date.now() + 365 * 86400000);
    setMsg({
      tone: warnings.length || expiringSoon ? "warn" : "ok",
      text: [`Filled in: ${d.fullName}, passport ${d.passportNo}${d.expiry ? `, expires ${d.expiry}` : ""}.`, ...warnings, ...(expiringSoon ? ["This passport expires within 12 months."] : [])].join(" "),
    });
  }

  return (
    <div ref={box} className="border border-dashed border-rule-2 rounded-[3px] p-3 bg-field">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <span className="text-[13px] font-medium">Fill from passport</span>
        <span className="text-[12px] text-muted">Name, passport no., dates, nationality and gender are filled for you to check.</span>
      </div>
      <div className="grid gap-2 lg:grid-cols-[1fr_auto] items-start">
        <textarea
          value={mrz}
          onChange={(e) => setMrz(e.target.value)}
          rows={2}
          spellCheck={false}
          placeholder={"P<NPLTHAPA<<RAM<BAHADUR<<<<<<<<<<<<<<<<<<<<<\nPA12345673NPL9503146M3105205<<<<<<<<<<<<<<06"}
          className="control num text-[12px] uppercase !min-h-[52px]"
          aria-label="Two lines from the bottom of the passport photo page"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btn("secondary")}
            onClick={() => {
              const r = parseMrz(mrz);
              if (r.ok) fill(r.data, r.warnings);
              else setMsg({ tone: "err", text: r.error });
            }}
          >
            Read lines
          </button>
          {photoEnabled && (
            <label className={cx(btn("secondary"), pending && "opacity-60 pointer-events-none")}>
              {pending ? "Reading photo…" : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const fd = new FormData();
                  fd.set("photo", f);
                  setMsg(null);
                  start(async () => {
                    const r = await scanPassportPhoto(fd);
                    if (r.ok) fill(r.data, r.warnings);
                    else setMsg({ tone: "err", text: r.error });
                  });
                }}
              />
            </label>
          )}
        </div>
      </div>
      {msg && <p className={cx("mt-2 text-[12.5px]", msg.tone === "err" ? "text-danger" : msg.tone === "warn" ? "text-warn" : "text-accent")}>{msg.text}</p>}
      {photoEnabled && <p className="mt-1.5 text-[11.5px] text-muted">Photos are sent to Anthropic&apos;s API to be read and are not stored by the CRM.</p>}
    </div>
  );
}
