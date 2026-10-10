"use client";

import { waLink } from "@/lib/format";
import { logMessage } from "@/app/(app)/messages/actions";
import { btn, cx } from "./ui";

/** Choose a saved message; it opens in WhatsApp with the details already filled in, and is logged on the candidate. */
export function TemplatePicker({ phone, templates, className, candidateId }: { phone: string; templates: { name: string; text: string }[]; className?: string; candidateId?: string }) {
  if (!templates.length) return null;
  return (
    <select
      aria-label="Send a saved WhatsApp message"
      className={cx(btn("secondary"), "control !w-auto !min-h-[34px] pr-8", className)}
      value=""
      onChange={(e) => {
        const t = templates[Number(e.target.value)];
        if (t) {
          window.open(waLink(phone, t.text), "_blank", "noopener");
          if (candidateId) void logMessage(candidateId, t.name, t.text);
        }
        e.target.value = "";
      }}
    >
      <option value="">Message template…</option>
      {templates.map((t, i) => (
        <option key={t.name} value={i}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
