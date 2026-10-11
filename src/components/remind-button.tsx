"use client";

import { waLink } from "@/lib/format";
import { logMessage } from "@/app/(app)/messages/actions";
import { btn } from "./ui";
import { WaIcon } from "./wa-icon";

/** Opens WhatsApp with a payment reminder already written, and logs it on the candidate. */
export function RemindButton({ phone, text, candidateId, size = "sm" }: { phone: string; text: string; candidateId?: string; size?: "sm" | "md" }) {
  return (
    <a
      href={waLink(phone, text)}
      target="_blank"
      rel="noreferrer"
      className={btn("quiet", size)}
      title="Send payment reminder on WhatsApp"
      onClick={() => {
        if (candidateId) void logMessage(candidateId, "Payment reminder", text);
      }}
    >
      <WaIcon /> Remind
    </a>
  );
}
