import { db } from "@/lib/db";
import { PLATFORM_LABEL } from "@/lib/constants";

export async function candidateFormOptions() {
  const [campaigns, partners, jobs, staff] = await Promise.all([
    db.campaign.findMany({ orderBy: { startDate: "desc" }, select: { id: true, name: true, platform: true, endDate: true } }),
    db.partner.findMany({ where: { type: { in: ["CANDIDATES", "BOTH"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, country: true } }),
    db.jobOrder.findMany({ where: { status: { in: ["OPEN", "ON_HOLD"] } }, orderBy: { receivedOn: "desc" }, select: { id: true, reference: true, position: true, country: true } }),
    db.user.findMany({ where: { active: true, role: { in: ["SALES", "MANAGEMENT", "OPERATIONS"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    campaigns: campaigns.map((c) => ({ value: c.id, label: `${c.name} (${PLATFORM_LABEL[c.platform as keyof typeof PLATFORM_LABEL]}${c.endDate && c.endDate < new Date() ? ", ended" : ""})` })),
    partners: partners.map((p) => ({ value: p.id, label: `${p.name}, ${p.country}` })),
    jobs: jobs.map((j) => ({ value: j.id, label: `${j.position}, ${j.country} · ${j.reference}` })),
    staff: staff.map((s) => ({ value: s.id, label: s.name })),
  };
}
