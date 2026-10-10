"use server";

import { addMonths, format } from "date-fns";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { amount, need, optNum, optStr, run, str } from "@/lib/action";
import { parseDateInput } from "@/lib/dates";
import { saveUpload } from "@/lib/upload";
import { money } from "@/lib/format";
import { BILL_CATEGORIES, EXPENSE_CATEGORIES, FREQUENCIES, FREQUENCY_MONTHS, PAYMENT_METHODS } from "@/lib/constants";

export async function saveBill(id: string | null, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("expenses.manage");
    const category = str(fd, "category");
    const frequency = str(fd, "frequency");
    if (!BILL_CATEGORIES.some((c) => c.value === category)) throw new Error("Choose a category.");
    if (!FREQUENCIES.some((f) => f.value === frequency)) throw new Error("Choose how often it repeats.");
    const dueDate = parseDateInput(fd.get("dueDate"));
    if (!dueDate) throw new Error("Due date is required.");
    const data = {
      name: need(fd, "name", "Bill name"), category, vendor: optStr(fd, "vendor"), amount: amount(fd, "amount", "Amount"),
      dueDate, frequency, remindDays: Math.max(0, optNum(fd, "remindDays") ?? 5),
    };
    if (id) {
      const before = await db.bill.findUniqueOrThrow({ where: { id } });
      await db.bill.update({ where: { id }, data });
      await audit({ userId: user.id, action: "UPDATE", entity: "Bill", entityId: id, summary: `Edited bill ${data.name}`, before, after: data });
    } else {
      const b = await db.bill.create({ data: { ...data, seriesId: randomBytes(9).toString("base64url") } });
      await audit({ userId: user.id, action: "CREATE", entity: "Bill", entityId: b.id, summary: `Added bill ${b.name} ${money(b.amount)}` });
    }
    return "Bill saved.";
  });
}

export async function payBill(id: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("expenses.manage");
    const b = await db.bill.findUniqueOrThrow({ where: { id } });
    if (b.status === "PAID") throw new Error("Already paid.");
    const method = str(fd, "method");
    if (!PAYMENT_METHODS.some((m) => m.value === method)) throw new Error("Choose the payment method.");
    const paidAmount = optNum(fd, "amount") ?? b.amount;
    const months = FREQUENCY_MONTHS[b.frequency] ?? 0;
    await db.$transaction([
      db.bill.update({ where: { id }, data: { status: "PAID", amount: paidAmount, paidOn: parseDateInput(fd.get("paidOn")) ?? new Date(), paidMethod: method, paidRef: optStr(fd, "paidRef") } }),
      // next bill in the series is created straight away
      ...(months
        ? [db.bill.create({ data: { name: b.name, category: b.category, vendor: b.vendor, amount: b.amount, dueDate: addMonths(b.dueDate, months), frequency: b.frequency, remindDays: b.remindDays, seriesId: b.seriesId } })]
        : []),
    ]);
    await audit({ userId: user.id, action: "UPDATE", entity: "Bill", entityId: id, summary: `Paid ${b.name} ${money(paidAmount)}` });
    return months ? `Paid. Next one created, due ${format(addMonths(b.dueDate, months), "d MMM yyyy")}.` : "Paid.";
  });
}

export async function deleteBill(id: string) {
  return run(async () => {
    const user = await requirePerm("expenses.manage");
    const b = await db.bill.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "Bill", entityId: id, summary: `Deleted bill ${b.name} due ${b.dueDate.toDateString()}`, before: b });
  });
}

export async function saveExpense(fd: FormData) {
  return run(async () => {
    const user = await requirePerm("expenses.manage");
    const category = str(fd, "category");
    if (!EXPENSE_CATEGORIES.some((c) => c.value === category)) throw new Error("Choose a category.");
    const file = await saveUpload(fd.get("file"), "expenses");
    const autoApprove = user.role === "ADMIN" || user.role === "MANAGEMENT";
    const e = await db.expense.create({
      data: {
        date: parseDateInput(fd.get("date")) ?? new Date(), category, amount: amount(fd, "amount", "Amount"),
        paidBy: need(fd, "paidBy", "Paid by"), method: str(fd, "method") || "CASH", note: optStr(fd, "note"),
        fileUrl: file?.url ?? null, fileName: file?.name ?? null, campaignId: optStr(fd, "campaignId"),
        createdById: user.id, status: autoApprove ? "APPROVED" : "PENDING",
        approvedById: autoApprove ? user.id : null, approvedAt: autoApprove ? new Date() : null,
      },
    });
    await audit({ userId: user.id, action: "CREATE", entity: "Expense", entityId: e.id, summary: `Expense ${money(e.amount)} (${e.note ?? category})` });
    return autoApprove ? "Expense saved." : "Expense saved and sent for approval.";
  });
}

export async function decideExpense(id: string, decision?: string) {
  return run(async () => {
    const user = await requirePerm("expenses.approve");
    const status = decision === "REJECTED" ? "REJECTED" : "APPROVED";
    const e = await db.expense.update({ where: { id }, data: { status, approvedById: user.id, approvedAt: new Date() } });
    await audit({ userId: user.id, action: "APPROVE", entity: "Expense", entityId: id, summary: `${status === "APPROVED" ? "Approved" : "Rejected"} expense ${money(e.amount)}` });
  });
}

export async function deleteExpense(id: string) {
  return run(async () => {
    const user = await requirePerm("expenses.manage");
    const e = await db.expense.findUniqueOrThrow({ where: { id } });
    if (e.status === "APPROVED" && user.role !== "ADMIN" && user.role !== "MANAGEMENT") throw new Error("Approved expenses can only be removed by management.");
    await db.expense.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "Expense", entityId: id, summary: `Deleted expense ${money(e.amount)}`, before: e });
  });
}
