import { db } from "./db";
import { getSettings } from "./settings";

const include = {
  receivedBy: { select: { name: true } },
  candidate: {
    select: {
      id: true, fullName: true, code: true, passportNo: true, phone: true, whatsapp: true, agreedAmount: true,
      jobOrder: { select: { position: true, country: true } },
      feePackage: { select: { name: true } },
    },
  },
} as const;

export async function loadReceipt(where: { id: string } | { shareToken: string }) {
  const p = await db.payment.findUnique({ where, include });
  if (!p) return null;
  const s = await getSettings();
  // balance as it stood right after this payment
  const upTo = await db.payment.aggregate({
    where: { candidateId: p.candidate.id, OR: [{ date: { lt: p.date } }, { date: p.date, createdAt: { lte: p.createdAt } }] },
    _sum: { amount: true },
  });
  const paidToDate = upTo._sum.amount ?? p.amount;
  return {
    p,
    paidToDate,
    balanceAfter: Math.max(p.candidate.agreedAmount - paidToDate, 0),
    agreed: p.candidate.agreedAmount,
    company: { name: s.companyName, address: s.companyAddress, phone: s.companyPhone, email: s.companyEmail, trn: s.companyTrn },
  };
}
