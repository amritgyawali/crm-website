import { differenceInCalendarDays, format } from "date-fns";

export const CURRENCY = "AED";

const money2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function money(n: number | null | undefined, opts: { cur?: boolean; whole?: boolean } = {}) {
  const v = Math.round((n ?? 0) * 100) / 100;
  const s = (opts.whole ? money0 : money2).format(Math.abs(v));
  const sign = v < 0 ? "-" : "";
  return opts.cur === false ? `${sign}${s}` : `${sign}${CURRENCY} ${s}`;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function d(date: Date | string | null | undefined, fmt = "d MMM yyyy") {
  if (!date) return "—";
  return format(new Date(date), fmt);
}
export const dt = (date: Date | string | null | undefined) => d(date, "d MMM yyyy, HH:mm");
export const dShort = (date: Date | string | null | undefined) => d(date, "d MMM");

/** "today", "in 3 days", "4 days ago" */
export function relDays(date: Date | string | null | undefined, now = new Date()) {
  if (!date) return "";
  const n = differenceInCalendarDays(new Date(date), now);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Digits only, for wa.me links. Assumes numbers are stored with country code. */
export function waNumber(phone?: string | null) {
  return (phone ?? "").replace(/[^\d]/g, "");
}
export function waLink(phone?: string | null, text?: string) {
  const n = waNumber(phone);
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
export const telLink = (phone?: string | null) => `tel:${(phone ?? "").replace(/[^\d+]/g, "")}`;

export function fillTemplate(body: string, vars: Record<string, string | number | null | undefined>) {
  return body.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "").toString());
}

export function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function under1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r]! : TENS[Math.floor(r / 10)]! + (r % 10 ? "-" + ONES[r % 10] : "");
  return [h ? ONES[h] + " hundred" : "", rest].filter(Boolean).join(" ");
}
/** 2450.5 → "Two thousand four hundred fifty dirhams and 50 fils" */
export function amountInWords(v: number, unit = "dirhams", sub = "fils") {
  const whole = Math.floor(Math.abs(v));
  const fils = Math.round((Math.abs(v) - whole) * 100);
  const parts: string[] = [];
  const scales: [number, string][] = [[1_000_000, "million"], [1000, "thousand"], [1, ""]];
  let n = whole;
  for (const [size, name] of scales) {
    const q = Math.floor(n / size);
    if (q) parts.push(under1000(q) + (name ? " " + name : ""));
    n %= size;
  }
  const words = (parts.join(" ") || "zero") + " " + unit + (fils ? ` and ${fils} ${sub}` : "");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
