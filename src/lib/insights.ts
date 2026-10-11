import { addDays, differenceInCalendarDays, differenceInMinutes, endOfMonth, format, startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from "date-fns";
import { db } from "./db";
import { computeLedger } from "./ledger";
import { CLOSED_STATUSES, LEAD_SOURCE_LABEL, PAYING_STATUSES } from "./constants";
import { round2 } from "./format";

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export const FUNNEL_STEPS = ["Leads", "Contacted", "Interested", "Enrolled & paid", "Visa process", "Deployed"] as const;

/** Candidates added in the period, and how far each one got. */
export async function funnel(days: number) {
  const from = startOfDay(subDays(new Date(), days));
  const cands = await db.candidate.findMany({
    where: { createdAt: { gte: from } },
    select: {
      id: true, status: true, stage: true, leadSource: true, createdAt: true, lastContactedAt: true, enrolledOn: true,
      assignedToId: true, assignedTo: { select: { name: true } },
      callLogs: { select: { outcome: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      payments: { select: { amount: true } },
    },
  });
  const reach = (c: (typeof cands)[number]) => {
    const paid = c.payments.length > 0;
    const deployed = c.status === "DEPLOYED";
    const process = !!c.stage || deployed;
    const enrolled = paid && (PAYING_STATUSES as string[]).concat(["WITHDRAWN", "REFUSED"]).includes(c.status);
    const interested = enrolled || c.status === "INTERESTED" || c.callLogs.some((l) => ["INTERESTED", "ENROLLED", "PAYMENT_PROMISED", "PAYMENT_RECEIVED"].includes(l.outcome));
    const contacted = interested || c.callLogs.some((l) => l.outcome !== "NO_ANSWER") || !["LEAD"].includes(c.status);
    return [true, contacted, interested, enrolled, process, deployed];
  };
  const rows = cands.map((c) => ({ c, r: reach(c), collected: c.payments.reduce((s, p) => s + p.amount, 0) }));
  const overall = FUNNEL_STEPS.map((_, i) => rows.filter((x) => x.r[i]).length);

  const group = (key: (c: (typeof cands)[number]) => string) => {
    const keys = [...new Set(cands.map(key))];
    return keys
      .map((k) => {
        const list = rows.filter((x) => key(x.c) === k);
        return {
          key: k,
          steps: FUNNEL_STEPS.map((_, i) => list.filter((x) => x.r[i]).length),
          collected: round2(list.reduce((s, x) => s + x.collected, 0)),
        };
      })
      .sort((a, b) => b.steps[0]! - a.steps[0]!);
  };

  // first-response time: minutes from being added to the first call of any kind
  const firstCall = cands
    .filter((c) => c.callLogs[0])
    .map((c) => ({ staff: c.assignedTo?.name ?? "Not assigned", mins: Math.max(differenceInMinutes(c.callLogs[0]!.createdAt, c.createdAt), 0) }));
  const neverCalled = cands.filter((c) => !c.callLogs.length && !CLOSED_STATUSES.includes(c.status as never)).length;
  const staffNames = [...new Set(firstCall.map((f) => f.staff))];
  const response = staffNames
    .map((s) => ({ staff: s, median: median(firstCall.filter((f) => f.staff === s).map((f) => f.mins))!, n: firstCall.filter((f) => f.staff === s).length }))
    .sort((a, b) => a.median - b.median);

  return {
    overall,
    bySource: group((c) => LEAD_SOURCE_LABEL[c.leadSource as keyof typeof LEAD_SOURCE_LABEL] ?? c.leadSource),
    byStaff: group((c) => c.assignedTo?.name ?? "Not assigned"),
    response,
    responseAll: median(firstCall.map((f) => f.mins)),
    neverCalled,
  };
}

export const AGING_BUCKETS = ["Not yet due", "1–30 days", "31–60 days", "61–90 days", "Over 90 days"] as const;

/** What candidates still owe, grouped by how late it is. */
export async function receivablesAging() {
  const today = startOfDay(new Date());
  const cands = await db.candidate.findMany({
    where: { status: { in: PAYING_STATUSES } },
    select: {
      id: true, fullName: true, code: true, status: true, agreedAmount: true, assignedTo: { select: { name: true } },
      installments: true, payments: { select: { amount: true } },
    },
  });
  const bucketOf = (due: Date | null) => {
    if (!due || due >= today) return 0;
    const late = differenceInCalendarDays(today, due);
    return late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
  };
  const totals = [0, 0, 0, 0, 0];
  const byStaff = new Map<string, number[]>();
  const debtors: { id: string; name: string; code: string; staff: string; overdue: number; oldestDays: number; balance: number }[] = [];
  let waitingOnStage = 0;

  for (const c of cands) {
    const L = computeLedger(c);
    const staff = c.assignedTo?.name ?? "Not assigned";
    const row = byStaff.get(staff) ?? [0, 0, 0, 0, 0];
    let overdue = 0;
    let oldest = 0;
    for (const r of L.rows) {
      if (r.outstanding <= 0.005) continue;
      if (!r.dueDate) {
        waitingOnStage += r.outstanding;
        continue;
      }
      const b = bucketOf(r.dueDate);
      totals[b]! += r.outstanding;
      row[b]! += r.outstanding;
      if (b > 0) {
        overdue += r.outstanding;
        oldest = Math.max(oldest, differenceInCalendarDays(today, r.dueDate));
      }
    }
    byStaff.set(staff, row);
    if (overdue > 0) debtors.push({ id: c.id, name: c.fullName, code: c.code, staff, overdue: round2(overdue), oldestDays: oldest, balance: L.balance });
  }
  return {
    totals: totals.map(round2),
    byStaff: [...byStaff.entries()].map(([staff, v]) => ({ staff, v: v.map(round2) })).sort((a, b) => b.v.slice(1).reduce((s, x) => s + x, 0) - a.v.slice(1).reduce((s, x) => s + x, 0)),
    debtors: debtors.sort((a, b) => b.overdue - a.overdue).slice(0, 15),
    waitingOnStage: round2(waitingOnStage),
  };
}

/** Scheduled installments for the coming weeks, so finance can see cash coming in. */
export async function collectionForecast(weeks = 8) {
  const today = startOfDay(new Date());
  const start = startOfWeek(today, { weekStartsOn: 1 });
  const end = addDays(start, weeks * 7 - 1);
  const cands = await db.candidate.findMany({
    where: { status: { in: PAYING_STATUSES }, installments: { some: {} } },
    select: { agreedAmount: true, status: true, installments: true, payments: { select: { amount: true } } },
  });
  const buckets = Array.from({ length: weeks }, (_, i) => ({ start: addDays(start, i * 7), amount: 0, count: 0 }));
  let overdueNow = 0;
  for (const c of cands) {
    for (const r of computeLedger(c).rows) {
      if (r.outstanding <= 0.005 || !r.dueDate) continue;
      if (r.dueDate < today) {
        overdueNow += r.outstanding;
        continue;
      }
      if (r.dueDate > end) continue;
      const i = Math.floor(differenceInCalendarDays(r.dueDate, start) / 7);
      buckets[i]!.amount += r.outstanding;
      buckets[i]!.count += 1;
    }
  }
  return { weeks: buckets.map((b) => ({ ...b, amount: round2(b.amount), label: format(b.start, "d MMM") })), overdueNow: round2(overdueNow) };
}

/** New leads and enrolments per month. */
export async function monthlyIntake(months = 6) {
  const list = Array.from({ length: months }, (_, i) => subMonths(new Date(), months - 1 - i));
  return Promise.all(
    list.map(async (m) => {
      const [leads, enrolled] = await Promise.all([
        db.candidate.count({ where: { createdAt: { gte: startOfMonth(m), lte: endOfMonth(m) } } }),
        db.candidate.count({ where: { enrolledOn: { gte: startOfMonth(m), lte: endOfMonth(m) } } }),
      ]);
      return { label: format(m, "MMM"), a: leads, b: enrolled };
    }),
  );
}
