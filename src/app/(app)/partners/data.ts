import { db } from "@/lib/db";
import { partnerMoney } from "@/lib/partners";

/** Per-partner totals: deployments and income from both their job orders and the candidates they supplied. */
export async function partnerTotals() {
  const [partners, cands, pays] = await Promise.all([
    db.partner.findMany({
      orderBy: { name: "asc" },
      include: {
        entries: { select: { direction: true, kind: true, amount: true } },
        agreements: { select: { expiresOn: true }, orderBy: { expiresOn: "asc" } },
        jobOrders: { select: { id: true, status: true } },
        contacts: { take: 1 },
      },
    }),
    db.candidate.findMany({ select: { id: true, status: true, sourcePartnerId: true, jobOrder: { select: { partnerId: true } } } }),
    db.payment.groupBy({ by: ["candidateId"], _sum: { amount: true } }),
  ]);
  const paid = new Map(pays.map((p) => [p.candidateId, p._sum.amount ?? 0]));
  return partners.map((p) => {
    const linked = cands.filter((c) => c.sourcePartnerId === p.id || c.jobOrder?.partnerId === p.id);
    const supplied = cands.filter((c) => c.sourcePartnerId === p.id);
    const m = partnerMoney(p.entries);
    const candidateFees = linked.reduce((s, c) => s + (paid.get(c.id) ?? 0), 0);
    const nextExpiry = p.agreements.find((a) => a.expiresOn)?.expiresOn ?? null;
    return {
      p, m,
      openJobs: p.jobOrders.filter((j) => j.status === "OPEN").length,
      jobs: p.jobOrders.length,
      supplied: supplied.length,
      selected: linked.filter((c) => ["IN_PROCESS", "DEPLOYED"].includes(c.status)).length,
      deployed: linked.filter((c) => c.status === "DEPLOYED").length,
      candidateFees,
      income: m.theyPaid + candidateFees - m.wePaid,
      nextExpiry,
    };
  });
}
