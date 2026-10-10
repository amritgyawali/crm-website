import { db } from "./db";
import { computeLedger } from "./ledger";
import { PAYING_STATUSES } from "./constants";

export type DueItem = {
  candidateId: string;
  code: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  assignedTo: string | null;
  assignedToId: string | null;
  jobOrder: string | null;
  installmentId: string;
  label: string;
  dueDate: Date;
  outstanding: number;
  balance: number;
};

/** Installments with money still owed, due on or before `until`. */
export async function getDueInstallments(opts: { until: Date; assignedToId?: string }) {
  const cands = await db.candidate.findMany({
    where: {
      status: { in: PAYING_STATUSES },
      ...(opts.assignedToId ? { assignedToId: opts.assignedToId } : {}),
      installments: { some: { dueDate: { lte: opts.until } } },
    },
    select: {
      id: true, code: true, fullName: true, phone: true, whatsapp: true, status: true, agreedAmount: true,
      assignedToId: true,
      assignedTo: { select: { name: true } },
      jobOrder: { select: { position: true, country: true } },
      installments: true,
      payments: { select: { amount: true } },
    },
  });
  const out: DueItem[] = [];
  for (const c of cands) {
    const l = computeLedger(c);
    for (const r of l.rows) {
      if (r.outstanding > 0.005 && r.dueDate && r.dueDate <= opts.until) {
        out.push({
          candidateId: c.id, code: c.code, name: c.fullName, phone: c.phone, whatsapp: c.whatsapp,
          assignedTo: c.assignedTo?.name ?? null, assignedToId: c.assignedToId,
          jobOrder: c.jobOrder ? `${c.jobOrder.position}, ${c.jobOrder.country}` : null,
          installmentId: r.id, label: r.label, dueDate: r.dueDate, outstanding: r.outstanding, balance: l.balance,
        });
      }
    }
  }
  return out.sort((a, b) => +a.dueDate - +b.dueDate);
}
