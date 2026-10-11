import { db } from "./db";
import { audit } from "./audit";
import { nextCandidateCode } from "./numbering";
import { normalizePhone, phoneTail } from "./phone";

export type IncomingLead = { name: string; phone: string; email?: string | null; nationality?: string | null; note?: string | null; campaignId?: string | null; externalIds?: string[] };

/** Creates a candidate from a lead form. Same phone already on file → nothing created. */
export async function intakeLead(lead: IncomingLead) {
  const phone = normalizePhone(lead.phone);
  const tail = phoneTail(phone);
  const existing = tail.length >= 8 ? await db.candidate.findFirst({ where: { phone: { endsWith: tail } } }) : null;
  if (existing) return { created: false as const, candidate: existing };

  const ext = (lead.externalIds ?? []).filter(Boolean);
  const campaign = lead.campaignId
    ? await db.campaign.findUnique({ where: { id: lead.campaignId } })
    : ext.length
      ? await db.campaign.findFirst({ where: { externalId: { in: ext } } })
      : null;

  const c = await db.$transaction(async (tx) =>
    tx.candidate.create({
      data: {
        code: await nextCandidateCode(tx), fullName: lead.name.trim(), phone, email: lead.email || null, nationality: lead.nationality || "Unknown",
        leadSource: campaign ? "CAMPAIGN" : "OTHER", campaignId: campaign?.id ?? null, jobOrderId: campaign?.jobOrderId ?? null,
        sourceNote: [lead.note, ext.length && !campaign ? `Unmatched ad/form ${ext.join("/")}` : ""].filter(Boolean).join(" · ") || "Imported from lead form",
      },
    }),
  );
  await audit({ action: "CREATE", entity: "Candidate", entityId: c.id, summary: `Lead imported: ${c.fullName}${campaign ? ` (${campaign.name})` : ""}` });
  return { created: true as const, candidate: c };
}
