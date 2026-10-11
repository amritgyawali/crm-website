/** Stored form of a phone number: digits with an optional leading +, no spaces or dashes. 00971… becomes +971… */
export function normalizePhone(raw: string) {
  const t = raw.trim();
  const plus = t.startsWith("+") || t.startsWith("00");
  const digits = t.replace(/\D/g, "").replace(/^00/, "");
  return (plus ? "+" : "") + digits;
}

/** Last 9 digits: the part that stays the same whether written +971 50…, 0050… or 050… */
export const phoneTail = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-9);
