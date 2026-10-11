import { telLink, waLink } from "@/lib/format";
import { btn, cx } from "./ui";
import { WaIcon } from "./wa-icon";

/** One-tap call and WhatsApp buttons. */
export function ContactButtons({ phone, whatsapp, text, size = "sm", className }: { phone: string | null | undefined; whatsapp?: string | null; text?: string; size?: "sm" | "md"; className?: string }) {
  if (!phone && !whatsapp) return null;
  return (
    <span className={cx("inline-flex gap-1.5", className)}>
      {phone && (
        <a href={telLink(phone)} className={btn("secondary", size)} title={`Call ${phone}`}>
          <PhoneIcon /> Call
        </a>
      )}
      <a href={waLink(whatsapp || phone, text)} target="_blank" rel="noreferrer" className={btn("secondary", size)} title="Open WhatsApp">
        <WaIcon /> WhatsApp
      </a>
    </span>
  );
}

export function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.2 1.8h2.4l1.2 3-1.6 1.1a8.4 8.4 0 0 0 4.9 4.9l1.1-1.6 3 1.2v2.4a1.4 1.4 0 0 1-1.5 1.4C7.3 13.9 2.1 8.7 1.8 3.3a1.4 1.4 0 0 1 1.4-1.5Z" />
    </svg>
  );
}
export { RemindButton } from "./remind-button";
export { WaIcon } from "./wa-icon";
