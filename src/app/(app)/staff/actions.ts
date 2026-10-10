"use server";

import { eachDayOfInterval, endOfMonth, format, startOfDay, startOfMonth, getDay } from "date-fns";
import { db } from "@/lib/db";
import { getUser, requirePerm } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { optNum, optStr, run, str } from "@/lib/action";
import { monthFromKey, parseDateInput } from "@/lib/dates";
import { ATTENDANCE_PAY, ATTENDANCE_STATUS } from "@/lib/constants";
import { money, round2 } from "@/lib/format";

export async function saveTarget(userId: string, month: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("staff.manage");
    const data = { calls: optNum(fd, "calls") ?? 0, enrolments: optNum(fd, "enrolments") ?? 0, collection: optNum(fd, "collection") ?? 0 };
    await db.target.upsert({ where: { userId_month: { userId, month } }, create: { userId, month, ...data }, update: data });
    await audit({ userId: user.id, action: "UPDATE", entity: "Target", entityId: userId, summary: `Set ${month} target: ${data.calls} calls, ${data.enrolments} enrolments, ${money(data.collection)}` });
    return "Target saved.";
  });
}

export async function setAttendance(userId: string, dateKey: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("staff.manage");
    const status = str(fd, "status");
    const date = startOfDay(parseDateInput(dateKey)!);
    if (!status) {
      await db.attendance.deleteMany({ where: { userId, date } });
      return "Cleared.";
    }
    if (!ATTENDANCE_STATUS.some((a) => a.value === status)) throw new Error("Unknown status.");
    const data = { status, checkIn: optStr(fd, "checkIn"), checkOut: optStr(fd, "checkOut"), note: optStr(fd, "note") };
    await db.attendance.upsert({ where: { userId_date: { userId, date } }, create: { userId, date, ...data }, update: data });
    await audit({ userId: user.id, action: "UPDATE", entity: "Attendance", entityId: userId, summary: `Attendance ${dateKey}: ${status}` });
    return "Saved.";
  });
}

/** Staff mark their own arrival / departure. */
export async function checkInOut() {
  return run(async () => {
    const user = await getUser();
    if (!user) throw new Error("Sign in again.");
    const date = startOfDay(new Date());
    const time = format(new Date(), "HH:mm");
    const row = await db.attendance.findUnique({ where: { userId_date: { userId: user.id, date } } });
    if (!row) {
      const late = time > "09:15";
      await db.attendance.create({ data: { userId: user.id, date, status: late ? "LATE" : "PRESENT", checkIn: time } });
      return `Checked in at ${time}.`;
    }
    await db.attendance.update({ where: { id: row.id }, data: { checkOut: time } });
    return `Checked out at ${time}.`;
  });
}

/** Builds draft salary sheets from attendance. Sundays are off. Approved or paid sheets are left alone. */
export async function generatePayroll(month: string) {
  return run(async () => {
    const user = await requirePerm("payroll.manage");
    const m = monthFromKey(month);
    const days = eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) }).filter((d) => getDay(d) !== 0);
    const staff = await db.user.findMany({ where: { active: true, monthlySalary: { gt: 0 } } });
    let made = 0;
    for (const u of staff) {
      const existing = await db.payroll.findUnique({ where: { userId_month: { userId: u.id, month } } });
      if (existing && existing.status !== "DRAFT") continue;
      const att = await db.attendance.findMany({ where: { userId: u.id, date: { gte: startOfMonth(m), lte: endOfMonth(m) } } });
      const workingDays = days.length;
      // days without a record count as absent only once they are in the past
      const marked = new Map(att.map((a) => [format(a.date, "yyyy-MM-dd"), a.status]));
      const today = startOfDay(new Date());
      let paidDays = 0;
      for (const d of days) {
        const st = marked.get(format(d, "yyyy-MM-dd"));
        if (st) paidDays += ATTENDANCE_PAY[st] ?? 0;
        else if (d >= today) paidDays += 1;
      }
      const base = u.monthlySalary;
      const deductions = existing?.deductions ?? 0;
      const additions = existing?.additions ?? 0;
      const netPay = round2((base * paidDays) / workingDays - deductions + additions);
      const data = { baseSalary: base, workingDays, paidDays, netPay, deductions, additions };
      await db.payroll.upsert({ where: { userId_month: { userId: u.id, month } }, create: { userId: u.id, month, ...data }, update: data });
      made++;
    }
    await audit({ userId: user.id, action: "CREATE", entity: "Payroll", summary: `Calculated payroll for ${month} (${made} staff)` });
    return `${made} salary sheets calculated. Review and send for approval.`;
  });
}

export async function updatePayroll(id: string, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("payroll.manage");
    const p = await db.payroll.findUniqueOrThrow({ where: { id } });
    if (p.status !== "DRAFT") throw new Error("Only drafts can be changed.");
    const deductions = optNum(fd, "deductions") ?? 0;
    const additions = optNum(fd, "additions") ?? 0;
    const netPay = round2((p.baseSalary * p.paidDays) / p.workingDays - deductions + additions);
    await db.payroll.update({ where: { id }, data: { deductions, additions, netPay, note: optStr(fd, "note") } });
    await audit({ userId: user.id, action: "UPDATE", entity: "Payroll", entityId: id, summary: `Adjusted payroll ${p.month}: −${deductions} +${additions}` });
    return "Updated.";
  });
}

export async function approvePayroll(month: string) {
  return run(async () => {
    const user = await requirePerm("payroll.approve");
    const r = await db.payroll.updateMany({ where: { month, status: "DRAFT" }, data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() } });
    await audit({ userId: user.id, action: "APPROVE", entity: "Payroll", summary: `Approved payroll ${month} (${r.count} staff)` });
  });
}

export async function markPayrollPaid(month: string) {
  return run(async () => {
    const user = await requirePerm("payroll.manage");
    const r = await db.payroll.updateMany({ where: { month, status: "APPROVED" }, data: { status: "PAID", paidOn: new Date() } });
    await audit({ userId: user.id, action: "UPDATE", entity: "Payroll", summary: `Marked payroll ${month} paid (${r.count} staff)` });
  });
}
