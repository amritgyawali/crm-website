import { db } from "@/lib/db";

/** Leads → enrolled (paid first installment) → deployed → money, per campaign. */
export async function campaignReport(where: { id?: string } = {}) {
  const campaigns = await db.campaign.findMany({
    where,
    orderBy: { startDate: "desc" },
    include: {
      jobOrder: { select: { id: true, reference: true, position: true, country: true } },
      candidates: { select: { id: true, status: true, payments: { select: { amount: true } } } },
    },
  });
  return campaigns.map((c) => {
    const leads = c.candidates.length;
    const enrolled = c.candidates.filter((x) => x.payments.length > 0 && ["ENROLLED", "IN_PROCESS", "DEPLOYED", "WITHDRAWN", "REFUSED"].includes(x.status)).length;
    const deployed = c.candidates.filter((x) => x.status === "DEPLOYED").length;
    const collected = c.candidates.reduce((s, x) => s + x.payments.reduce((t, p) => t + p.amount, 0), 0);
    return {
      c, leads, enrolled, deployed, collected,
      cpl: leads ? c.amountSpent / leads : null,
      cpe: enrolled ? c.amountSpent / enrolled : null,
      roi: c.amountSpent ? collected / c.amountSpent : null,
    };
  });
}
