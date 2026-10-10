"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { need, optNum, optStr, run, str } from "@/lib/action";
import { parseDateInput } from "@/lib/dates";
import { PLATFORMS } from "@/lib/constants";

export async function saveCampaign(id: string | null, fd: FormData) {
  let target = id;
  const res = await run(async () => {
    const user = await requirePerm("campaigns.manage");
    const platform = str(fd, "platform");
    if (!PLATFORMS.some((p) => p.value === platform)) throw new Error("Choose the platform.");
    const startDate = parseDateInput(fd.get("startDate"));
    if (!startDate) throw new Error("Start date is required.");
    const endDate = parseDateInput(fd.get("endDate"));
    if (endDate && endDate < startDate) throw new Error("End date is before the start date.");
    const data = {
      name: need(fd, "name", "Campaign name"), platform, jobOrderId: optStr(fd, "jobOrderId"), startDate, endDate,
      amountSpent: Math.max(0, optNum(fd, "amountSpent") ?? 0), externalId: optStr(fd, "externalId"), notes: optStr(fd, "notes"),
    };
    if (id) {
      const before = await db.campaign.findUniqueOrThrow({ where: { id } });
      await db.campaign.update({ where: { id }, data });
      await audit({ userId: user.id, action: "UPDATE", entity: "Campaign", entityId: id, summary: `Edited campaign ${data.name}`, before, after: data });
    } else {
      const c = await db.campaign.create({ data });
      target = c.id;
      await audit({ userId: user.id, action: "CREATE", entity: "Campaign", entityId: c.id, summary: `Added campaign ${data.name}` });
    }
  });
  if (res?.ok) redirect(`/campaigns/${target}`);
  return res;
}

export async function deleteCampaign(id: string) {
  const res = await run(async () => {
    const user = await requirePerm("campaigns.manage");
    const c = await db.campaign.findUniqueOrThrow({ where: { id }, include: { _count: { select: { candidates: true } } } });
    if (c._count.candidates) throw new Error("Candidates are linked to this campaign. It cannot be deleted.");
    await db.campaign.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "Campaign", entityId: id, summary: `Deleted campaign ${c.name}`, before: c });
  });
  if (res?.ok) redirect("/campaigns");
  return res;
}
