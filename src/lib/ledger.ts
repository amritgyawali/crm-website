import { startOfDay } from "date-fns";
import { CLOSED_STATUSES, type CandidateStatus } from "./constants";
import { round2 } from "./format";

type Inst = { id: string; sequence: number; label: string; amount: number; dueDate: Date | null; stage: string | null };
type Pay = { amount: number };
type Ref = { status: string; policyAmount: number };

export type LedgerRow = Inst & { paid: number; outstanding: number; state: "PAID" | "PART" | "DUE" | "OVERDUE" | "WAITING" };

/**
 * Payments are applied to installments oldest first.
 * An installment linked to a stage has no date until that stage is reached.
 */
export function computeLedger(
  c: { agreedAmount: number; status: string; installments: Inst[]; payments: Pay[]; refunds?: Ref[] },
  now = new Date(),
) {
  const today = startOfDay(now);
  const paid = round2(c.payments.reduce((s, p) => s + p.amount, 0));
  const refunded = round2((c.refunds ?? []).filter((r) => r.status === "PAID").reduce((s, r) => s + r.policyAmount, 0));
  const refundPending = (c.refunds ?? []).some((r) => r.status === "PENDING" || r.status === "APPROVED");
  const closed = CLOSED_STATUSES.includes(c.status as CandidateStatus);

  let pool = paid;
  const rows: LedgerRow[] = [...c.installments]
    .sort((a, b) => a.sequence - b.sequence)
    .map((i) => {
      const alloc = round2(Math.min(i.amount, Math.max(pool, 0)));
      pool = round2(pool - alloc);
      const outstanding = round2(i.amount - alloc);
      let state: LedgerRow["state"];
      if (outstanding <= 0.005) state = "PAID";
      else if (!i.dueDate) state = alloc > 0 ? "PART" : "WAITING";
      else if (i.dueDate < today) state = "OVERDUE";
      else state = alloc > 0 ? "PART" : "DUE";
      return { ...i, paid: alloc, outstanding, state };
    });

  const balance = closed ? 0 : round2(Math.max(c.agreedAmount - paid, 0));
  const open = closed ? [] : rows.filter((r) => r.outstanding > 0.005);
  const nextDue = open.filter((r) => r.dueDate).sort((a, b) => +a.dueDate! - +b.dueDate!)[0] ?? null;
  const overdue = round2(open.filter((r) => r.state === "OVERDUE").reduce((s, r) => s + r.outstanding, 0));
  const planned = round2(c.installments.reduce((s, i) => s + i.amount, 0));

  return { paid, refunded, refundPending, balance, rows, nextDue, overdue, planned, closed, retained: round2(paid - refunded) };
}
