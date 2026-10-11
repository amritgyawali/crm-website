"use server";

import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { run, str } from "@/lib/action";

const STATUS_RANK = ["NOT_INTERESTED", "NOT_ELIGIBLE", "LEAD", "CONTACTED", "INTERESTED", "WITHDRAWN", "REFUSED", "ENROLLED", "IN_PROCESS", "DEPLOYED"];

/** Moves everything from the other records into the chosen one, then deletes the others. */
export async function mergeCandidates(groupKey: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("settings.manage");
    const ids = groupKey.split(",");
    const keepId = str(fd, "keep");
    if (!ids.includes(keepId)) throw new Error("Choose which record to keep.");
    const others = ids.filter((i) => i !== keepId);
    const keep = await db.candidate.findUnique({ where: { id: keepId }, include: { installments: true, stageEvents: true } });
    if (!keep) throw new Error("That record no longer exists. Reload the page.");
    // most advanced record first, so its details win when filling gaps
    const rest = (await db.candidate.findMany({ where: { id: { in: others } }, include: { installments: true, stageEvents: true } }))
      .sort((a, b) => STATUS_RANK.indexOf(b.status) - STATUS_RANK.indexOf(a.status));
    if (!rest.length) throw new Error("The other records were already merged or deleted. Reload the page.");

    // a fee plan and a visa history each come from ONE record only
    const planFrom = keep.installments.length ? null : rest.find((o) => o.installments.length) ?? null;
    const visaFrom = keep.stageEvents.length ? null : rest.find((o) => o.stageEvents.length) ?? null;

    await db.$transaction(async (tx) => {
      for (const o of rest) {
        await tx.callLog.updateMany({ where: { candidateId: o.id }, data: { candidateId: keepId } });
        await tx.payment.updateMany({ where: { candidateId: o.id }, data: { candidateId: keepId } });
        await tx.refund.updateMany({ where: { candidateId: o.id }, data: { candidateId: keepId } });
        await tx.document.updateMany({ where: { candidateId: o.id }, data: { candidateId: keepId } });
        await tx.messageLog.updateMany({ where: { candidateId: o.id }, data: { candidateId: keepId } });
      }
      if (planFrom) await tx.installment.updateMany({ where: { candidateId: planFrom.id }, data: { candidateId: keepId } });
      if (visaFrom) await tx.stageEvent.updateMany({ where: { candidateId: visaFrom.id }, data: { candidateId: keepId } });

      // fill gaps; fields that belong together are copied together from the same record
      const fill: Record<string, unknown> = {};
      const empty = (v: unknown) => v === null || v === undefined || v === "";
      const groups: (keyof typeof keep)[][] = [
        ["passportNo", "passportExpiry"], ["whatsapp"], ["email"], ["gender"], ["dateOfBirth"], ["currentLocation"],
        ["trade", "experienceYears"], ["jobOrderId"], ["assignedToId"], ["lastContactedAt"], ["nextCallAt"],
      ];
      for (const g of groups) {
        if (!g.every((f) => empty(keep[f]))) continue;
        const donor = rest.find((o) => g.some((f) => !empty(o[f])));
        if (donor) for (const f of g) fill[f] = donor[f];
      }
      // the fee plan and the visa stage travel with the records they came from
      if (planFrom) Object.assign(fill, { feePackageId: planFrom.feePackageId, agreedAmount: planFrom.agreedAmount, enrolledOn: keep.enrolledOn ?? planFrom.enrolledOn });
      if (visaFrom) Object.assign(fill, { stage: visaFrom.stage, stageEnteredAt: visaFrom.stageEnteredAt });
      const best = [keep, ...rest].reduce((b, c) => (STATUS_RANK.indexOf(c.status) > STATUS_RANK.indexOf(b.status) ? c : b));
      if (best.status !== keep.status) fill.status = best.status;
      fill.notes = [keep.notes, ...rest.map((o) => `Merged from ${o.code} (${o.fullName}, ${o.phone})${o.notes ? `: ${o.notes}` : ""}`)].filter(Boolean).join("\n");
      await tx.candidate.update({ where: { id: keepId }, data: fill });
      await tx.candidate.deleteMany({ where: { id: { in: rest.map((o) => o.id) } } });
    });
    await audit({ userId: user.id, action: "UPDATE", entity: "Candidate", entityId: keepId, summary: `Merged ${rest.map((o) => o.code).join(", ")} into ${keep.code} (${keep.fullName})`, before: rest });
    return `Merged into ${keep.code}.`;
  });
}

export async function ignoreGroup(groupKey: string) {
  return run(async () => {
    await requirePerm("settings.manage");
    const row = await db.setting.findUnique({ where: { key: "dupIgnored" } });
    const list: string[] = row ? JSON.parse(row.value) : [];
    if (!list.includes(groupKey)) list.push(groupKey);
    await db.setting.upsert({ where: { key: "dupIgnored" }, create: { key: "dupIgnored", value: JSON.stringify(list) }, update: { value: JSON.stringify(list) } });
  });
}
