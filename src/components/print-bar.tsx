"use client";

import { btn } from "./ui";
import { waLink } from "@/lib/format";

export function PrintBar({ back, share }: { back?: string; share?: { phone: string; text: string; path?: string } }) {
  return (
    <div className="no-print max-w-[720px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-2">
      {back ? <a href={back} className="text-[13px] text-muted hover:text-ink">← Back</a> : <span />}
      <div className="flex gap-2">
        {share && (
          <button
            type="button"
            className={btn("secondary")}
            onClick={() => {
              const link = share.path ? `\n${window.location.origin}${share.path}` : "";
              window.open(waLink(share.phone, share.text + link), "_blank", "noopener");
            }}
          >
            Send on WhatsApp
          </button>
        )}
        <button type="button" className={btn("primary")} onClick={() => window.print()}>Print / save PDF</button>
      </div>
    </div>
  );
}
