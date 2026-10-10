"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { need, optNum, optStr, run, str } from "@/lib/action";
import { parseDateInput } from "@/lib/dates";
import { JOB_STATUS } from "@/lib/constants";

function fields(fd: FormData) {
  const status = str(fd, "status") || "OPEN";
  if (!JOB_STATUS.some((s) => s.value === status)) throw new Error("Choose a status.");
  return {
    reference: need(fd, "reference", "Reference / RRF number").toUpperCase(),
    position: need(fd, "position", "Position"),
    employer: need(fd, "employer", "Employer"),
    partnerId: optStr(fd, "partnerId"),
    country: need(fd, "country", "Country"),
    city: optStr(fd, "city"),
    vacancies: Math.max(1, optNum(fd, "vacancies") ?? 1),
    salary: optStr(fd, "salary"),
    contractMonths: Math.max(1, optNum(fd, "contractMonths") ?? 24),
    status,
    receivedOn: parseDateInput(fd.get("receivedOn")) ?? new Date(),
    deadline: parseDateInput(fd.get("deadline")),
    requirements: optStr(fd, "requirements"),
  };
}

export async function saveJob(id: string | null, fd: FormData) {
  let target = id;
  const res = await run(async () => {
    const user = await requirePerm("jobs.manage");
    const data = fields(fd);
    const dup = await db.jobOrder.findUnique({ where: { reference: data.reference } });
    if (dup && dup.id !== id) throw new Error(`Reference ${data.reference} is already used.`);
    if (id) {
      const before = await db.jobOrder.findUniqueOrThrow({ where: { id } });
      await db.jobOrder.update({ where: { id }, data });
      await audit({ userId: user.id, action: "UPDATE", entity: "JobOrder", entityId: id, summary: `Edited job order ${data.reference}`, before, after: data });
    } else {
      const j = await db.jobOrder.create({ data });
      target = j.id;
      await audit({ userId: user.id, action: "CREATE", entity: "JobOrder", entityId: j.id, summary: `Added job order ${data.reference}` });
    }
  });
  if (res?.ok) redirect(`/jobs/${target}`);
  return res;
}

export async function deleteJob(id: string) {
  const res = await run(async () => {
    const user = await requirePerm("jobs.manage");
    const j = await db.jobOrder.findUniqueOrThrow({ where: { id }, include: { _count: { select: { candidates: true, feePackages: true } } } });
    if (j._count.candidates || j._count.feePackages) throw new Error("Candidates or fee packages use this job order. Set it to Closed instead.");
    await db.jobOrder.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "JobOrder", entityId: id, summary: `Deleted job order ${j.reference}`, before: j });
  });
  if (res?.ok) redirect("/jobs");
  return res;
}
