import { round2 } from "./format";

type Entry = { direction: string; kind: string; amount: number };

export function partnerMoney(entries: Entry[]) {
  const sum = (dir: string, kind: string) => round2(entries.filter((e) => e.direction === dir && e.kind === kind).reduce((s, e) => s + e.amount, 0));
  const rc = sum("RECEIVABLE", "CHARGE"), rp = sum("RECEIVABLE", "PAYMENT");
  const pc = sum("PAYABLE", "CHARGE"), pp = sum("PAYABLE", "PAYMENT");
  return { theyOwe: rc, theyPaid: rp, theyOweOut: round2(rc - rp), weOwe: pc, wePaid: pp, weOweOut: round2(pc - pp) };
}
