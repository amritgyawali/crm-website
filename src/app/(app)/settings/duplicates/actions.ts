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
    const keep = await db.candidate.findUniqueOrThrow({ where: { id: keepId }, include: { installments: true, stageEvents: true } });
    const rest = await db.candidate.findMany({ where: { id: { in: others } }, include: { installments: true, stageEvents: true } });

    await db.$transaction(async (tx) => {
      for (const o of rest) {
        await tx.callLog.updateMany({ where: { candidateId: o.id }, data: { candidateId: keepId } });
        await tx.payment.updateMany({ where: { candidateId: o.id }, data: { candidateId: keepId } });
        await tx.refund.updateMany({ where: { candidateId: o.id }, data: { candidateId: keepId } });
        await tx.document.updateMany({ where: { candidateId: o.id }, data: { candidateId: keepId } });
        await tx.messageLog.updateMany({ where: { candidateId: o.id }, data: { candidateId: keepId } });
        // a fee plan or visa history only moves across when the kept record has none
        if (!keep.installments.length && o.installments.length) await tx.installment.updateMany({ where: { candidateId: o.id }, data: { candidateId: keepId } });
        if (!keep.stageEvents.length && o.stageEvents.length) await tx.stageEvent.updateMany({ where: { candidateId: o.id }, data: { candidateId: keepId } });
      }
      // fill gaps on the kept record from the others
      const fill: Record<string, unknown> = {};
      const fields = ["whatsapp", "email", "gender", "dateOfBirth", "currentLocation", "trade", "experienceYears", "passportNo", "passportExpiry", "jobOrderId", "assignedToId", "feePackageId", "enrolledOn", "stage", "stageEnteredAt", "lastContactedAt", "nextCallAt", "notes"] as const;
      for (const f of fields) {
        if (keep[f] === null || keep[f] === undefined || keep[f] === "") {
          const v = rest.find((o) => o[f] !== null && o[f] !== undefined && o[f] !== "")?.[f];
          if (v !== undefined) fill[f] = v;
        }
      }
      if (!keep.agreedAmount) {
        const a = rest.find((o) => o.agreedAmount > 0)?.agreedAmount;
        if (a) fill.agreedAmount = a;
      }
      const best = [keep, ...rest].reduce((b, c) => (STATUS_RANK.indexOf(c.status) > STATUS_RANK.indexOf(b.status) ? c : b));
      if (best.status !== keep.status) fill.status = best.status;
      const extraNotes = rest.map((o) => `Merged from ${o.code} (${o.fullName}, ${o.phone})`).join("\n");
      fill.notes = [keep.notes ?? (fill.notes as string | undefined), extraNotes].filter(Boolean).join("\n");
      await tx.candidate.update({ where: { id: keepId }, data: fill });
      await tx.candidate.deleteMany({ where: { id: { in: others } } });
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
