import { addDays, startOfDay } from "date-fns";
import { db } from "./db";
import { can } from "./permissions";
import { getDueInstallments } from "./dues";
import { getSettings, num } from "./settings";
import { CLOSED_STATUSES } from "./constants";
import { money } from "./format";

export const EVENT_TYPES = [
  { key: "fee", label: "Fee due", color: "#1f7a55" },
  { key: "call", label: "Call-back", color: "#45423c" },
  { key: "embassy", label: "Embassy / VFS", color: "#2d4b66" },
  { key: "flight", label: "Flight", color: "#8f5600" },
  { key: "checkin", label: "Post-arrival check-in", color: "#5b7f3a" },
  { key: "bill", label: "Office bill", color: "#c4793a" },
  { key: "partner", label: "Partner", color: "#78736a" },
  { key: "job", label: "Job deadline", color: "#78736a" },
] as const;
export type EventType = (typeof EVENT_TYPES)[number]["key"];

export type CalEvent = { id: string; type: EventType; date: Date; timed: boolean; title: string; detail: string; href: string; late?: boolean };

/** Everything with a date between `from` and `to`, limited to what the user's role may see. */
export async function getEvents(user: { id: string; role: string }, from: Date, to: Date, mineOnly: boolean): Promise<CalEvent[]> {
  const s = await getSettings();
  const mine = mineOnly || !can(user.role, "calls.viewAll");
  const today = startOfDay(new Date());
  const out: CalEvent[] = [];
  const timed = (d: Date) => d.getHours() !== 0 || d.getMinutes() !== 0;

  // fees: show anything owed up to the end of the range; overdue ones land on their original date
  if (can(user.role, "payment.record") || can(user.role, "finance.view")) {
    const dues = await getDueInstallments({ until: to, assignedToId: mine && !can(user.role, "finance.view") ? user.id : mineOnly ? user.id : undefined });
    for (const x of dues) {
      if (x.dueDate < from) continue;
      out.push({ id: "fee" + x.installmentId, type: "fee", date: x.dueDate, timed: false, title: x.name, detail: `${x.label}: ${money(x.outstanding)}`, href: `/candidates/${x.candidateId}`, late: x.dueDate < today });
    }
  }

  if (can(user.role, "call.log")) {
    const calls = await db.candidate.findMany({
      where: { nextCallAt: { gte: from, lte: to }, status: { notIn: CLOSED_STATUSES }, ...(mine ? { assignedToId: user.id } : {}) },
      select: { id: true, fullName: true, nextCallAt: true, assignedTo: { select: { name: true } } },
    });
    for (const c of calls)
      out.push({ id: "call" + c.id, type: "call", date: c.nextCallAt!, timed: timed(c.nextCallAt!), title: c.fullName, detail: c.assignedTo && !mine ? c.assignedTo.name : "Your call", href: `/candidates/${c.id}` });
  }

  // embassy appointments and flights for open cases
  const evs = await db.stageEvent.findMany({
    where: {
      stage: { in: ["VFS_BOOKED", "FLIGHT_BOOKED"] }, appointmentAt: { gte: from, lte: to },
      candidate: { status: { in: ["IN_PROCESS", "DEPLOYED"] }, ...(mineOnly ? { assignedToId: user.id } : {}) },
    },
    include: { candidate: { select: { id: true, fullName: true, jobOrder: { select: { country: true } } } } },
  });
  for (const e of evs) {
    out.push({
      id: "st" + e.id, type: e.stage === "VFS_BOOKED" ? "embassy" : "flight", date: e.appointmentAt!, timed: timed(e.appointmentAt!),
      title: e.candidate.fullName,
      detail: (e.stage === "VFS_BOOKED" ? e.location : e.flightDetails) ?? e.candidate.jobOrder?.country ?? "",
      href: `/candidates/${e.candidate.id}`,
    });
  }

  const checkDays = num(s.postArrivalCheckDays, 30);
  const arrived = await db.candidate.findMany({
    where: { stage: "ARRIVED", status: "DEPLOYED", stageEnteredAt: { gte: addDays(from, -checkDays), lte: addDays(to, -checkDays) }, ...(mineOnly ? { assignedToId: user.id } : {}) },
    select: { id: true, fullName: true, stageEnteredAt: true, jobOrder: { select: { country: true } } },
  });
  for (const c of arrived) {
    const due = addDays(c.stageEnteredAt!, checkDays);
    out.push({ id: "ci" + c.id, type: "checkin", date: due, timed: false, title: c.fullName, detail: c.jobOrder?.country ?? "Arrived", href: `/candidates/${c.id}`, late: due < today });
  }

  if (can(user.role, "expenses.manage") && !mineOnly) {
    const bills = await db.bill.findMany({ where: { status: "UNPAID", dueDate: { gte: from, lte: to } } });
    for (const b of bills) out.push({ id: "b" + b.id, type: "bill", date: b.dueDate, timed: false, title: b.name, detail: money(b.amount), href: "/expenses/bills", late: b.dueDate < today });
  }

  if ((can(user.role, "partners.manage") || can(user.role, "partners.finance")) && !mineOnly) {
    const [ags, fups] = await Promise.all([
      db.partnerAgreement.findMany({ where: { expiresOn: { gte: from, lte: to } }, include: { partner: { select: { id: true, name: true } } } }),
      db.partner.findMany({ where: { nextFollowUp: { gte: from, lte: to } }, select: { id: true, name: true, nextFollowUp: true } }),
    ]);
    for (const a of ags) out.push({ id: "a" + a.id, type: "partner", date: a.expiresOn!, timed: false, title: a.partner.name, detail: `${a.title} expires`, href: `/partners/${a.partner.id}` });
    for (const p of fups) out.push({ id: "pf" + p.id, type: "partner", date: p.nextFollowUp!, timed: false, title: p.name, detail: "Follow-up due", href: `/partners/${p.id}` });
  }

  if (!mineOnly) {
    const jobs = await db.jobOrder.findMany({ where: { deadline: { gte: from, lte: to }, status: { in: ["OPEN", "ON_HOLD"] } } });
    for (const j of jobs) out.push({ id: "j" + j.id, type: "job", date: j.deadline!, timed: false, title: j.reference, detail: `${j.position}, ${j.country}`, href: `/jobs/${j.id}` });
  }

  return out.sort((a, b) => +a.date - +b.date);
}
