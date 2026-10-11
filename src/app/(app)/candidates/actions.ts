"use server";

import { addDays, startOfDay } from "date-fns";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { amount, need, optNum, optStr, run, str } from "@/lib/action";
import { parseDateInput } from "@/lib/dates";
import { getSettings, num } from "@/lib/settings";
import { nextCandidateCode, nextReceiptNo, shareToken } from "@/lib/numbering";
import { saveUpload } from "@/lib/upload";
import { normalizePhone, phoneTail } from "@/lib/phone";
import { money, round2 } from "@/lib/format";
import {
  CALL_OUTCOMES, CANDIDATE_STATUS, CLOSED_STATUSES, LEAD_SOURCES, PAYMENT_METHODS, REFUSABLE_STAGES, STAGE_LABEL,
  STAGE_ORDER, stageIndex, type CandidateStatus, type Stage,
} from "@/lib/constants";

const oneOf = <T extends string>(v: string, list: readonly { value: T }[], label: string): T => {
  const hit = list.find((o) => o.value === v);
  if (!hit) throw new Error(`Choose a ${label}.`);
  return hit.value;
};

// ---------------------------------------------------------------- candidate record

function candidateFields(fd: FormData) {
  const leadSource = oneOf(str(fd, "leadSource"), LEAD_SOURCES, "lead source");
  const campaignId = optStr(fd, "campaignId");
  const sourcePartnerId = optStr(fd, "sourcePartnerId");
  if (leadSource === "CAMPAIGN" && !campaignId) throw new Error("Pick the campaign this lead came from.");
  if (leadSource === "PARTNER" && !sourcePartnerId) throw new Error("Pick the partner who sent this candidate.");
  const phone = normalizePhone(need(fd, "phone", "Phone"));
  if (phone.replace(/\D/g, "").length < 8) throw new Error("Phone number looks too short. Include the country code.");
  const whatsapp = optStr(fd, "whatsapp");
  return {
    fullName: need(fd, "fullName", "Full name"),
    phone,
    whatsapp: whatsapp ? normalizePhone(whatsapp) : null,
    email: optStr(fd, "email"),
    gender: optStr(fd, "gender"),
    dateOfBirth: parseDateInput(fd.get("dateOfBirth")),
    nationality: need(fd, "nationality", "Nationality"),
    currentLocation: optStr(fd, "currentLocation"),
    trade: optStr(fd, "trade"),
    experienceYears: optNum(fd, "experienceYears"),
    passportNo: optStr(fd, "passportNo"),
    passportExpiry: parseDateInput(fd.get("passportExpiry")),
    leadSource,
    campaignId: leadSource === "CAMPAIGN" ? campaignId : null,
    sourcePartnerId: leadSource === "PARTNER" ? sourcePartnerId : null,
    referredBy: leadSource === "REFERRAL" ? optStr(fd, "referredBy") : null,
    sourceNote: optStr(fd, "sourceNote"),
    jobOrderId: optStr(fd, "jobOrderId"),
    assignedToId: optStr(fd, "assignedToId"),
    notes: optStr(fd, "notes"),
  };
}

export async function createCandidate(fd: FormData) {
  let id = "";
  const res = await run(async () => {
    const user = await requirePerm("candidate.edit");
    const data = candidateFields(fd);
    const dup = await db.candidate.findFirst({
      where: { OR: [{ phone: { endsWith: phoneTail(data.phone) } }, ...(data.passportNo ? [{ passportNo: data.passportNo }] : [])] },
      select: { code: true, fullName: true },
    });
    if (dup && str(fd, "allowDuplicate") !== "1")
      throw new Error(`${dup.fullName} (${dup.code}) already has this phone or passport number. Tick "save anyway" if this is a different person.`);
    const c = await db.$transaction(async (tx) =>
      tx.candidate.create({
        data: { ...data, code: await nextCandidateCode(tx), assignedToId: data.assignedToId ?? (user.role === "SALES" ? user.id : null) },
      }),
    );
    id = c.id;
    await audit({ userId: user.id, action: "CREATE", entity: "Candidate", entityId: c.id, summary: `Added candidate ${c.fullName} (${c.code})` });
  });
  if (res?.ok) redirect(`/candidates/${id}`);
  return res;
}

export async function updateCandidate(id: string, fd: FormData) {
  const res = await run(async () => {
    const user = await requirePerm("candidate.edit");
    const before = await db.candidate.findUniqueOrThrow({ where: { id } });
    const data = candidateFields(fd);
    const status = str(fd, "status");
    const extra: { status?: string } = {};
    if (status && status !== before.status && can(user.role, "candidate.assign")) extra.status = oneOf(status, CANDIDATE_STATUS, "status");
    if (!can(user.role, "candidate.assign")) data.assignedToId = before.assignedToId;
    const after = await db.candidate.update({ where: { id }, data: { ...data, ...extra } });
    await audit({ userId: user.id, action: "UPDATE", entity: "Candidate", entityId: id, summary: `Edited ${after.fullName}`, before, after });
  });
  if (res?.ok) redirect(`/candidates/${id}`);
  return res;
}

export async function assignCandidate(id: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("candidate.assign");
    const assignedToId = optStr(fd, "assignedToId");
    const c = await db.candidate.update({ where: { id }, data: { assignedToId }, include: { assignedTo: true } });
    await audit({ userId: user.id, action: "UPDATE", entity: "Candidate", entityId: id, summary: `Assigned ${c.fullName} to ${c.assignedTo?.name ?? "nobody"}` });
    return "Assigned.";
  });
}

export async function bulkAssign(fd: FormData) {
  return run(async () => {
    const user = await requirePerm("candidate.assign");
    const ids = fd.getAll("ids").map(String).filter(Boolean);
    if (!ids.length) throw new Error("Tick at least one candidate.");
    const to = optStr(fd, "assignTo");
    if (!to) throw new Error("Choose who to assign them to.");
    const staff = await db.user.findUniqueOrThrow({ where: { id: to } });
    const r = await db.candidate.updateMany({ where: { id: { in: ids } }, data: { assignedToId: to } });
    await audit({ userId: user.id, action: "UPDATE", entity: "Candidate", summary: `Assigned ${r.count} candidates to ${staff.name}` });
    return `${r.count} candidate${r.count === 1 ? "" : "s"} assigned to ${staff.name}.`;
  });
}

export async function deleteCandidate(id: string) {
  const res = await run(async () => {
    const user = await requirePerm("candidate.delete");
    const c = await db.candidate.findUniqueOrThrow({ where: { id }, include: { _count: { select: { payments: true } } } });
    if (c._count.payments) throw new Error("This candidate has payments. Close the case instead of deleting.");
    await db.candidate.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "Candidate", entityId: id, summary: `Deleted ${c.fullName} (${c.code})`, before: c });
  });
  if (res?.ok) redirect("/candidates");
  return res;
}

// ---------------------------------------------------------------- calls

export async function logCall(candidateId: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("call.log");
    const outcome = oneOf(str(fd, "outcome"), CALL_OUTCOMES, "call outcome");
    const c = await db.candidate.findUniqueOrThrow({ where: { id: candidateId } });

    let nextCallAt = parseDateInput(fd.get("nextCallAt"));
    const nextIn = optNum(fd, "nextIn");
    if (!nextCallAt && nextIn) nextCallAt = addDays(startOfDay(new Date()), nextIn);
    if (nextCallAt && nextCallAt.getHours() === 0) nextCallAt.setHours(10, 0, 0, 0);
    const promisedDate = parseDateInput(fd.get("promisedDate"));
    if (outcome === "PAYMENT_PROMISED" && !nextCallAt && promisedDate) nextCallAt = new Date(promisedDate.setHours(10, 0, 0, 0));
    // never let a lead go quiet: unanswered calls come back tomorrow
    if (!nextCallAt && (outcome === "NO_ANSWER" || outcome === "CALL_BACK")) nextCallAt = addDays(startOfDay(new Date()), 1);
    if (nextCallAt) nextCallAt.setHours(nextCallAt.getHours() || 10);

    await db.callLog.create({
      data: {
        candidateId, userId: user.id, outcome, channel: str(fd, "channel") === "WHATSAPP" ? "WHATSAPP" : "PHONE",
        note: optStr(fd, "note"), nextCallAt, promisedDate, promisedAmount: optNum(fd, "promisedAmount"),
      },
    });

    let status = c.status as CandidateStatus;
    const closed = CLOSED_STATUSES.includes(status);
    if (!closed) {
      if (outcome === "NOT_INTERESTED" && ["LEAD", "CONTACTED", "INTERESTED"].includes(status)) status = "NOT_INTERESTED";
      else if (outcome === "NOT_ELIGIBLE" && ["LEAD", "CONTACTED", "INTERESTED"].includes(status)) status = "NOT_ELIGIBLE";
      else if (outcome === "ENROLLED" && ["LEAD", "CONTACTED", "INTERESTED"].includes(status)) status = "ENROLLED";
      else if (outcome === "INTERESTED" && ["LEAD", "CONTACTED"].includes(status)) status = "INTERESTED";
      else if (outcome !== "NO_ANSWER" && status === "LEAD") status = "CONTACTED";
    }
    const closing = !closed && CLOSED_STATUSES.includes(status);
    await db.candidate.update({
      where: { id: candidateId },
      data: {
        lastContactedAt: new Date(),
        nextCallAt: closing ? null : nextCallAt,
        status,
        ...(status === "ENROLLED" && !c.enrolledOn ? { enrolledOn: new Date() } : {}),
        ...(closing ? { closedAt: new Date(), closedReason: outcome === "NOT_ELIGIBLE" ? "Not eligible" : "Not interested" } : {}),
        ...(!c.assignedToId && user.role === "SALES" ? { assignedToId: user.id } : {}),
      },
    });
    return "Call saved.";
  });
}

export async function deleteCallLog(id: string) {
  return run(async () => {
    const user = await requirePerm("call.log");
    const log = await db.callLog.findUniqueOrThrow({ where: { id } });
    const fresh = Date.now() - log.createdAt.getTime() < 15 * 60 * 1000;
    if (!(log.userId === user.id && fresh) && !can(user.role, "calls.viewAll"))
      throw new Error("You can only remove your own call within 15 minutes of logging it.");
    await db.callLog.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "CallLog", entityId: id, summary: "Removed a call log", before: log });
  });
}

// ---------------------------------------------------------------- fee ledger

async function checkFeeRules(total: number, destination: string | null | undefined, nationality: string | null | undefined) {
  const rules = await db.feeRule.findMany({
    where: { OR: [{ side: "DESTINATION", country: destination ?? "-" }, { side: "ORIGIN", country: nationality ?? "-" }] },
  });
  for (const r of rules) {
    if (total > r.maxAmount + 0.001)
      throw new Error(
        `${money(total)} is above the ${r.side === "ORIGIN" ? "origin" : "destination"} fee limit for ${r.country} (${money(r.maxAmount)}).${r.note ? " " + r.note : ""}`,
      );
  }
}

export async function setupLedger(candidateId: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("ledger.setup");
    const s = await getSettings();
    const c = await db.candidate.findUniqueOrThrow({
      where: { id: candidateId },
      include: { installments: true, stageEvents: true, jobOrder: true },
    });
    const pkg = await db.feePackage.findUniqueOrThrow({ where: { id: need(fd, "packageId", "Fee package") }, include: { steps: true, jobOrder: true } });
    const discount = optNum(fd, "discount") ?? 0;
    if (discount < 0 || discount >= pkg.totalAmount) throw new Error("Discount must be between zero and the package total.");
    const total = round2(pkg.totalAmount - discount);
    await checkFeeRules(total, pkg.country ?? pkg.jobOrder?.country ?? c.jobOrder?.country, c.nationality);
    if (c.installments.length && str(fd, "replace") !== "1") throw new Error("This candidate already has an installment plan. Tick “replace current plan” to rebuild it.");

    const enrolledOn = c.enrolledOn ?? parseDateInput(fd.get("enrolledOn")) ?? new Date();
    const reached = new Map(c.stageEvents.filter((e) => e.result === "DONE").map((e) => [e.stage, e.date]));
    const stageDue = num(s.stageDueDays, 5);
    const steps = [...pkg.steps].sort((a, b) => a.sequence - b.sequence);
    // the discount comes off the last installments first
    let cut = discount;
    const amounts = steps.map((st) => st.amount);
    for (let i = amounts.length - 1; i >= 0 && cut > 0; i--) {
      const take = Math.min(amounts[i]!, cut);
      amounts[i] = round2(amounts[i]! - take);
      cut = round2(cut - take);
    }

    await db.$transaction(async (tx) => {
      await tx.installment.deleteMany({ where: { candidateId } });
      for (const [i, st] of steps.entries()) {
        if (amounts[i]! <= 0) continue;
        let dueDate: Date | null = null;
        if (st.dueAfterDays !== null) dueDate = addDays(startOfDay(enrolledOn), st.dueAfterDays);
        else if (st.stage && reached.get(st.stage)) dueDate = addDays(startOfDay(reached.get(st.stage)!), stageDue);
        await tx.installment.create({ data: { candidateId, sequence: st.sequence, label: st.label, amount: amounts[i]!, dueDate, stage: st.stage } });
      }
      await tx.candidate.update({
        where: { id: candidateId },
        data: {
          feePackageId: pkg.id, agreedAmount: total, enrolledOn,
          status: ["LEAD", "CONTACTED", "INTERESTED"].includes(c.status) ? "ENROLLED" : c.status,
          jobOrderId: c.jobOrderId ?? pkg.jobOrderId,
        },
      });
    });
    await audit({ userId: user.id, action: "UPDATE", entity: "Ledger", entityId: candidateId, summary: `Fee plan set for ${c.fullName}: ${pkg.name}, ${money(total)}${discount ? ` (discount ${money(discount)})` : ""}` });
    return "Fee plan saved.";
  });
}

export async function saveInstallment(candidateId: string, installmentId: string | null, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("ledger.setup");
    const c = await db.candidate.findUniqueOrThrow({ where: { id: candidateId }, include: { installments: true, jobOrder: true } });
    const data = {
      label: need(fd, "label", "Description"),
      amount: amount(fd, "amount", "Amount"),
      dueDate: parseDateInput(fd.get("dueDate")),
      stage: optStr(fd, "stage"),
    };
    if (!data.dueDate && !data.stage) throw new Error("Give a due date or link it to a stage.");
    const others = c.installments.filter((i) => i.id !== installmentId).reduce((s, i) => s + i.amount, 0);
    const newTotal = round2(others + data.amount);
    await checkFeeRules(newTotal, c.jobOrder?.country, c.nationality);
    if (installmentId) {
      const before = await db.installment.findUniqueOrThrow({ where: { id: installmentId } });
      await db.installment.update({ where: { id: installmentId }, data });
      await audit({ userId: user.id, action: "UPDATE", entity: "Installment", entityId: installmentId, summary: `Changed installment "${data.label}" for ${c.fullName}`, before, after: data });
    } else {
      const seq = Math.max(0, ...c.installments.map((i) => i.sequence)) + 1;
      await db.installment.create({ data: { ...data, candidateId, sequence: seq } });
      await audit({ userId: user.id, action: "CREATE", entity: "Installment", entityId: candidateId, summary: `Added installment "${data.label}" ${money(data.amount)} for ${c.fullName}` });
    }
    await db.candidate.update({ where: { id: candidateId }, data: { agreedAmount: newTotal } });
    return "Installment saved.";
  });
}

export async function deleteInstallment(id: string) {
  return run(async () => {
    const user = await requirePerm("ledger.setup");
    const inst = await db.installment.findUniqueOrThrow({ where: { id }, include: { candidate: { include: { installments: true } } } });
    await db.installment.delete({ where: { id } });
    const total = round2(inst.candidate.installments.filter((i) => i.id !== id).reduce((s, i) => s + i.amount, 0));
    await db.candidate.update({ where: { id: inst.candidateId }, data: { agreedAmount: total } });
    await audit({ userId: user.id, action: "DELETE", entity: "Installment", entityId: id, summary: `Removed installment "${inst.label}" from ${inst.candidate.fullName}`, before: inst });
  });
}

// ---------------------------------------------------------------- payments

export async function recordPayment(candidateId: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("payment.record");
    const s = await getSettings();
    const c = await db.candidate.findUniqueOrThrow({ where: { id: candidateId }, include: { payments: true } });
    if (CLOSED_STATUSES.includes(c.status as CandidateStatus)) throw new Error("This case is closed. Payments cannot be added.");
    const amt = amount(fd, "amount", "Amount");
    const method = oneOf(str(fd, "method"), PAYMENT_METHODS, "payment method");
    const date = parseDateInput(fd.get("date")) ?? new Date();
    if (date > addDays(new Date(), 1)) throw new Error("Payment date cannot be in the future.");
    if (date.getHours() === 0 && date.toDateString() === new Date().toDateString()) date.setTime(Date.now());
    const receivedById = can(user.role, "payment.edit") ? optStr(fd, "receivedById") ?? user.id : user.id;
    const paid = c.payments.reduce((x, p) => x + p.amount, 0);
    if (c.agreedAmount > 0 && paid + amt > c.agreedAmount + 0.001 && str(fd, "allowOver") !== "1")
      throw new Error(`This is more than the balance (${money(c.agreedAmount - paid)}). Check the amount, or tick “allow overpayment”.`);
    if (method !== "CASH" && !optStr(fd, "reference") && method === "BANK_TRANSFER")
      throw new Error("Enter the bank transfer reference so finance can match it with the statement.");

    const p = await db.$transaction(async (tx) => {
      const pay = await tx.payment.create({
        data: {
          receiptNo: await nextReceiptNo(tx, s.receiptPrefix, date), shareToken: shareToken(),
          candidateId, amount: amt, method, date, reference: optStr(fd, "reference"), note: optStr(fd, "note"), receivedById,
        },
      });
      if (["LEAD", "CONTACTED", "INTERESTED"].includes(c.status))
        await tx.candidate.update({ where: { id: candidateId }, data: { status: "ENROLLED", enrolledOn: c.enrolledOn ?? date } });
      return pay;
    });
    await audit({ userId: user.id, action: "CREATE", entity: "Payment", entityId: p.id, summary: `Payment ${p.receiptNo} ${money(amt)} from ${c.fullName}`, after: p });
    return `Saved. Receipt ${p.receiptNo}.`;
  });
}

export async function updatePayment(id: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("payment.edit");
    const reason = need(fd, "reason", "Reason for the change");
    const before = await db.payment.findUniqueOrThrow({ where: { id }, include: { candidate: { select: { fullName: true } } } });
    const data = {
      amount: amount(fd, "amount", "Amount"),
      method: oneOf(str(fd, "method"), PAYMENT_METHODS, "payment method"),
      date: parseDateInput(fd.get("date")) ?? before.date,
      reference: optStr(fd, "reference"),
      note: optStr(fd, "note"),
      receivedById: optStr(fd, "receivedById") ?? before.receivedById,
    };
    const after = await db.payment.update({ where: { id }, data });
    const { candidate: _c, ...plainBefore } = before;
    void _c;
    await audit({ userId: user.id, action: "UPDATE", entity: "Payment", entityId: id, summary: `Changed payment ${before.receiptNo} (${before.candidate.fullName}). Reason: ${reason}`, before: plainBefore, after });
    return "Payment updated. The change is in the activity log.";
  });
}

export async function deletePayment(id: string, reason?: string) {
  return run(async () => {
    const user = await requirePerm("payment.edit");
    if (!reason?.trim()) throw new Error("Give a reason for deleting this payment.");
    const before = await db.payment.findUniqueOrThrow({ where: { id }, include: { candidate: { select: { fullName: true } } } });
    await db.payment.delete({ where: { id } });
    const { candidate: _c, ...plain } = before;
    void _c;
    await audit({ userId: user.id, action: "DELETE", entity: "Payment", entityId: id, summary: `Deleted payment ${before.receiptNo} ${money(before.amount)} (${before.candidate.fullName}). Reason: ${reason}`, before: plain });
  });
}

// ---------------------------------------------------------------- visa & deployment stages

export async function updateStage(candidateId: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("stage.update");
    const s = await getSettings();
    const stage = str(fd, "stage") as Stage;
    if (!STAGE_ORDER.includes(stage)) throw new Error("Choose a stage.");
    const result = str(fd, "result") === "REFUSED" ? "REFUSED" : "DONE";
    if (result === "REFUSED" && !REFUSABLE_STAGES.includes(stage)) throw new Error("Only the work permit or visa decision can be recorded as refused.");
    const date = parseDateInput(fd.get("date")) ?? new Date();
    const c = await db.candidate.findUniqueOrThrow({ where: { id: candidateId }, include: { payments: true, installments: true } });
    if (CLOSED_STATUSES.includes(c.status as CandidateStatus)) throw new Error("This case is closed.");
    if (!c.jobOrderId) throw new Error("Link the candidate to a job order before starting the visa process.");
    const refusalReason = optStr(fd, "refusalReason");
    if (result === "REFUSED" && !refusalReason) throw new Error("Enter the refusal reason.");

    await db.stageEvent.create({
      data: {
        candidateId, stage, result, date, userId: user.id, note: optStr(fd, "note"),
        appointmentAt: parseDateInput(fd.get("appointmentAt")), location: optStr(fd, "location"),
        flightDetails: optStr(fd, "flightDetails"), refusalReason,
      },
    });

    if (result === "REFUSED") {
      const paid = round2(c.payments.reduce((x, p) => x + p.amount, 0));
      await db.$transaction([
        db.candidate.update({
          where: { id: candidateId },
          data: { status: "REFUSED", closedAt: date, closedReason: `${STAGE_LABEL[stage].replace("approved", "refused")}: ${refusalReason}`, nextCallAt: null },
        }),
        db.refund.create({
          data: {
            candidateId, reason: stage === "WP_APPROVED" ? "WP_REFUSED" : "VISA_REFUSED", stageAtClose: stage,
            paidToDate: paid, policyAmount: optNum(fd, "refundAmount") ?? paid, requestedById: user.id,
            note: `Opened automatically when the ${stage === "WP_APPROVED" ? "work permit" : "visa"} was refused.`,
          },
        }),
      ]);
      await audit({ userId: user.id, action: "UPDATE", entity: "Candidate", entityId: candidateId, summary: `${c.fullName}: ${stage === "WP_APPROVED" ? "work permit" : "visa"} refused. Case closed, refund opened.` });
      return "Refusal recorded. The case is closed and a refund record is waiting for approval.";
    }

    const goesForward = stageIndex(stage) >= stageIndex(c.stage);
    const stageDue = num(s.stageDueDays, 5);
    await db.$transaction([
      ...(goesForward
        ? [db.candidate.update({
            where: { id: candidateId },
            data: { stage, stageEnteredAt: date, status: stageIndex(stage) >= stageIndex("ARRIVED") ? "DEPLOYED" : "IN_PROCESS" },
          })]
        : []),
      // installments waiting on this stage now get a due date
      ...c.installments
        .filter((i) => i.stage === stage && !i.dueDate)
        .map((i) => db.installment.update({ where: { id: i.id }, data: { dueDate: addDays(startOfDay(date), stageDue) } })),
    ]);
    await audit({ userId: user.id, action: "UPDATE", entity: "Candidate", entityId: candidateId, summary: `${c.fullName}: ${STAGE_LABEL[stage]}` });
    const linked = c.installments.filter((i) => i.stage === stage && !i.dueDate).length;
    return linked ? `Stage saved. ${linked} installment${linked > 1 ? "s are" : " is"} now due in ${stageDue} days.` : "Stage saved.";
  });
}

export async function deleteStageEvent(id: string) {
  return run(async () => {
    const user = await requirePerm("stage.update");
    const ev = await db.stageEvent.findUniqueOrThrow({ where: { id } });
    await db.stageEvent.delete({ where: { id } });
    const latest = await db.stageEvent.findFirst({ where: { candidateId: ev.candidateId, result: "DONE" }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
    const c = await db.candidate.findUniqueOrThrow({ where: { id: ev.candidateId } });
    if (!CLOSED_STATUSES.includes(c.status as CandidateStatus)) {
      await db.candidate.update({
        where: { id: ev.candidateId },
        data: {
          stage: latest?.stage ?? null, stageEnteredAt: latest?.date ?? null,
          status: latest ? (stageIndex(latest.stage) >= stageIndex("ARRIVED") ? "DEPLOYED" : "IN_PROCESS") : c.enrolledOn ? "ENROLLED" : c.status,
        },
      });
    }
    await audit({ userId: user.id, action: "DELETE", entity: "StageEvent", entityId: id, summary: `Removed stage entry ${STAGE_LABEL[ev.stage as Stage]}`, before: ev });
  });
}

/** Withdrawal or other closure. Opens a refund record when money was paid. */
export async function closeCase(candidateId: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("refund.request");
    const reason = str(fd, "reason");
    if (!["WITHDRAWN", "NOT_ELIGIBLE", "OTHER"].includes(reason)) throw new Error("Choose why the case is closing.");
    const note = need(fd, "note", "Note");
    const c = await db.candidate.findUniqueOrThrow({ where: { id: candidateId }, include: { payments: true } });
    if (CLOSED_STATUSES.includes(c.status as CandidateStatus)) throw new Error("This case is already closed.");
    const paid = round2(c.payments.reduce((x, p) => x + p.amount, 0));
    const refundAmount = optNum(fd, "refundAmount") ?? 0;
    if (refundAmount < 0 || refundAmount > paid) throw new Error(`Refund must be between 0 and the amount paid (${money(paid)}).`);
    await db.$transaction([
      db.candidate.update({
        where: { id: candidateId },
        data: { status: reason === "NOT_ELIGIBLE" ? "NOT_ELIGIBLE" : "WITHDRAWN", closedAt: new Date(), closedReason: note, nextCallAt: null },
      }),
      ...(paid > 0
        ? [db.refund.create({
            data: { candidateId, reason, stageAtClose: c.stage, paidToDate: paid, policyAmount: refundAmount, note, requestedById: user.id },
          })]
        : []),
    ]);
    await audit({ userId: user.id, action: "UPDATE", entity: "Candidate", entityId: candidateId, summary: `Closed case for ${c.fullName}: ${note}` });
    return paid > 0 ? "Case closed. Refund record sent for management approval." : "Case closed.";
  });
}

// ---------------------------------------------------------------- documents

export async function uploadDocument(candidateId: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("document.upload");
    const file = await saveUpload(fd.get("file"), `candidates/${candidateId}`);
    if (!file) throw new Error("Choose a file to upload.");
    const kind = str(fd, "kind") || "OTHER";
    const expiresOn = parseDateInput(fd.get("expiresOn"));
    await db.document.create({
      data: { candidateId, kind, title: optStr(fd, "title") ?? file.name, fileUrl: file.url, fileName: file.name, expiresOn, uploadedById: user.id },
    });
    if (kind === "PASSPORT" && expiresOn) await db.candidate.update({ where: { id: candidateId }, data: { passportExpiry: expiresOn } });
    return "Document uploaded.";
  });
}

export async function deleteDocument(id: string) {
  return run(async () => {
    const user = await requirePerm("document.upload");
    const doc = await db.document.findUniqueOrThrow({ where: { id } });
    await db.document.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "Document", entityId: id, summary: `Removed document ${doc.title}`, before: doc });
  });
}
