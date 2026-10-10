"use server";

import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { amount, need, optStr, run, str } from "@/lib/action";
import { parseDateInput } from "@/lib/dates";
import { money } from "@/lib/format";
import { PAYMENT_METHODS, STAGE_ORDER } from "@/lib/constants";

// ---------------------------------------------------------------- refunds

export async function approveRefund(id: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("refund.approve");
    const before = await db.refund.findUniqueOrThrow({ where: { id }, include: { candidate: { select: { fullName: true } } } });
    if (before.status !== "PENDING") throw new Error("This refund was already decided.");
    const decision = str(fd, "decision");
    const policyAmount = amount(fd, "policyAmount", "Refund amount", { allowZero: true });
    if (policyAmount > before.paidToDate + 0.001) throw new Error(`Refund cannot be more than what was paid (${money(before.paidToDate)}).`);
    const status = decision === "REJECT" ? "REJECTED" : "APPROVED";
    await db.refund.update({
      where: { id },
      data: { status, policyAmount, approvedById: user.id, approvedAt: new Date(), approvalNote: optStr(fd, "approvalNote") },
    });
    await audit({ userId: user.id, action: "APPROVE", entity: "Refund", entityId: id, summary: `${status === "APPROVED" ? "Approved" : "Rejected"} refund ${money(policyAmount)} for ${before.candidate.fullName}`, before });
    return status === "APPROVED" ? "Approved. Finance can now pay it." : "Refund rejected.";
  });
}

export async function markRefundPaid(id: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("refund.pay");
    const r = await db.refund.findUniqueOrThrow({ where: { id }, include: { candidate: { select: { fullName: true } } } });
    if (r.status !== "APPROVED") throw new Error("Only approved refunds can be paid.");
    const method = str(fd, "method");
    if (!PAYMENT_METHODS.some((m) => m.value === method)) throw new Error("Choose how it was refunded.");
    await db.refund.update({
      where: { id },
      data: { status: "PAID", refundedOn: parseDateInput(fd.get("refundedOn")) ?? new Date(), refundMethod: method, refundRef: optStr(fd, "refundRef") },
    });
    await audit({ userId: user.id, action: "UPDATE", entity: "Refund", entityId: id, summary: `Refunded ${money(r.policyAmount)} to ${r.candidate.fullName}` });
    return "Marked as refunded.";
  });
}

// ---------------------------------------------------------------- packages

export async function savePackage(id: string | null, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("packages.manage");
    const labels = fd.getAll("stepLabel").map(String);
    const amounts = fd.getAll("stepAmount").map((v) => Number(String(v).replace(/,/g, "")));
    const whens = fd.getAll("stepWhen").map(String);
    const days = fd.getAll("stepDays").map((v) => Number(v));
    const steps = labels
      .map((label, i) => ({ label: label.trim(), amount: amounts[i] ?? 0, when: whens[i] ?? "DAYS", days: days[i] || 0 }))
      .filter((s) => s.label && s.amount > 0);
    if (!steps.length) throw new Error("Add at least one installment.");
    const total = Math.round(steps.reduce((s, x) => s + x.amount, 0) * 100) / 100;
    const jobOrderId = optStr(fd, "jobOrderId");
    const job = jobOrderId ? await db.jobOrder.findUnique({ where: { id: jobOrderId } }) : null;
    const country = optStr(fd, "country") ?? job?.country ?? null;
    if (!country) throw new Error("Pick a job order or a destination country.");
    const rule = await db.feeRule.findFirst({ where: { side: "DESTINATION", country } });
    if (rule && total > rule.maxAmount) throw new Error(`Total ${money(total)} is above the limit for ${country} (${money(rule.maxAmount)}). ${rule.note ?? ""}`);

    const data = { name: need(fd, "name", "Package name"), jobOrderId, country, totalAmount: total, refundPolicy: optStr(fd, "refundPolicy") };
    const stepRows = steps.map((s, i) => ({
      sequence: i + 1, label: s.label, amount: s.amount,
      dueAfterDays: STAGE_ORDER.includes(s.when as never) ? null : s.days,
      stage: STAGE_ORDER.includes(s.when as never) ? s.when : null,
    }));
    if (id) {
      await db.$transaction([
        db.feePackageStep.deleteMany({ where: { packageId: id } }),
        db.feePackage.update({ where: { id }, data: { ...data, steps: { create: stepRows } } }),
      ]);
    } else {
      await db.feePackage.create({ data: { ...data, steps: { create: stepRows } } });
    }
    await audit({ userId: user.id, action: id ? "UPDATE" : "CREATE", entity: "FeePackage", entityId: id, summary: `${id ? "Changed" : "Created"} fee package ${data.name} (${money(total)})` });
    return "Package saved. Existing candidates keep their current plan.";
  });
}

export async function togglePackage(id: string) {
  return run(async () => {
    const user = await requirePerm("packages.manage");
    const p = await db.feePackage.findUniqueOrThrow({ where: { id } });
    await db.feePackage.update({ where: { id }, data: { active: !p.active } });
    await audit({ userId: user.id, action: "UPDATE", entity: "FeePackage", entityId: id, summary: `${p.active ? "Retired" : "Re-activated"} fee package ${p.name}` });
  });
}

export async function saveFeeRule(fd: FormData) {
  return run(async () => {
    const user = await requirePerm("packages.manage");
    const side = str(fd, "side") === "ORIGIN" ? "ORIGIN" : "DESTINATION";
    const country = need(fd, "country", "Country");
    const data = { country, side, maxAmount: amount(fd, "maxAmount", "Maximum fee"), note: optStr(fd, "note") };
    const existing = await db.feeRule.findFirst({ where: { country, side } });
    if (existing) await db.feeRule.update({ where: { id: existing.id }, data });
    else await db.feeRule.create({ data });
    await audit({ userId: user.id, action: "UPDATE", entity: "FeeRule", summary: `Fee limit ${side.toLowerCase()} ${country}: ${money(data.maxAmount)}` });
    return "Fee limit saved.";
  });
}

export async function deleteFeeRule(id: string) {
  return run(async () => {
    const user = await requirePerm("packages.manage");
    const r = await db.feeRule.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "FeeRule", entityId: id, summary: `Removed fee limit for ${r.country}`, before: r });
  });
}

