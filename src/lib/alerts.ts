import { addDays, addMonths, differenceInCalendarDays, subDays } from "date-fns";
import { db } from "./db";
import { can } from "./permissions";
import { getSettings, getStageDays, num } from "./settings";
import { ranges } from "./dates";
import { getDueInstallments } from "./dues";
import { CLOSED_STATUSES, STAGE_LABEL, type Stage } from "./constants";
import { d, money, relDays } from "./format";

export type AlertItem = { id: string; title: string; detail: string; href: string; tone: "danger" | "warn" | "plain"; when?: Date | null };
export type AlertGroup = { key: string; title: string; items: AlertItem[] };

type U = { id: string; role: string };

/**
 * All reminders for one staff member. Sales staff see their own candidates;
 * management sees everything. Nothing is stored — the list is worked out
 * from the records each time, so it is never out of date.
 */
export async function getAlerts(user: U): Promise<AlertGroup[]> {
  const s = await getSettings();
  const stageDays = await getStageDays();
  const r = ranges();
  const mine = !can(user.role, "calls.viewAll");
  const scope = mine ? { assignedToId: user.id } : {};
  const groups: AlertGroup[] = [];
  const openCase = { status: { notIn: CLOSED_STATUSES } };

  // --- payments due soon / overdue
  if (can(user.role, "payment.record") || can(user.role, "finance.view")) {
    const reminderDays = num(s.paymentReminderDays, 3);
    const dues = await getDueInstallments({
      until: addDays(r.todayEnd, reminderDays),
      assignedToId: mine && !can(user.role, "finance.view") ? user.id : undefined,
    });
    groups.push({
      key: "payments",
      title: "Candidate payments due",
      items: dues.map((x) => ({
        id: x.installmentId,
        title: `${x.name} · ${x.label}`,
        detail: `${money(x.outstanding)} due ${relDays(x.dueDate)}${x.assignedTo ? ` · ${x.assignedTo}` : ""}`,
        href: `/candidates/${x.candidateId}`,
        tone: x.dueDate < r.todayStart ? "danger" : "warn",
        when: x.dueDate,
      })),
    });
  }

  // --- call-backs
  if (can(user.role, "call.log")) {
    const callbacks = await db.candidate.findMany({
      where: { ...scope, ...openCase, nextCallAt: { lte: r.todayEnd } },
      select: { id: true, fullName: true, nextCallAt: true, assignedTo: { select: { name: true } } },
      orderBy: { nextCallAt: "asc" },
      take: 200,
    });
    groups.push({
      key: "callbacks",
      title: "Call-backs due",
      items: callbacks.map((c) => ({
        id: c.id,
        title: c.fullName,
        detail: `Call back ${relDays(c.nextCallAt)}${c.assignedTo ? ` · ${c.assignedTo.name}` : ""}`,
        href: `/candidates/${c.id}`,
        tone: c.nextCallAt! < r.todayStart ? "danger" : "warn",
        when: c.nextCallAt,
      })),
    });

    const days = num(s.leadNoContactDays, 2);
    const cutoff = subDays(r.now, days);
    const stale = await db.candidate.findMany({
      where: {
        ...scope,
        status: { in: ["LEAD", "CONTACTED", "INTERESTED"] },
        nextCallAt: null,
        OR: [{ lastContactedAt: null, createdAt: { lt: cutoff } }, { lastContactedAt: { lt: cutoff } }],
      },
      select: { id: true, fullName: true, createdAt: true, lastContactedAt: true, assignedTo: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    groups.push({
      key: "uncontacted",
      title: `Leads not contacted in ${days}+ days`,
      items: stale.map((c) => ({
        id: c.id,
        title: c.fullName,
        detail: `${c.lastContactedAt ? `Last call ${relDays(c.lastContactedAt)}` : `Added ${relDays(c.createdAt)}, never called`}${c.assignedTo ? ` · ${c.assignedTo.name}` : " · unassigned"}`,
        href: `/candidates/${c.id}`,
        tone: "warn",
        when: c.lastContactedAt ?? c.createdAt,
      })),
    });
  }

  // --- visa process
  if (can(user.role, "stage.update")) {
    const inProcess = await db.candidate.findMany({
      where: { stage: { not: null }, ...openCase },
      select: {
        id: true, fullName: true, stage: true, stageEnteredAt: true, passportExpiry: true,
        jobOrder: { select: { contractMonths: true } },
      },
    });
    const stuck: AlertItem[] = [];
    const checkIns: AlertItem[] = [];
    for (const c of inProcess) {
      if (!c.stageEnteredAt || !c.stage) continue;
      const days = differenceInCalendarDays(r.now, c.stageEnteredAt);
      if (c.stage === "ARRIVED") {
        const due = addDays(c.stageEnteredAt, num(s.postArrivalCheckDays, 30));
        if (due <= r.in7)
          checkIns.push({
            id: c.id, title: c.fullName, detail: `Post-arrival check-in due ${relDays(due)}`,
            href: `/candidates/${c.id}`, tone: due < r.todayStart ? "danger" : "warn", when: due,
          });
        continue;
      }
      const max = stageDays[c.stage as Stage];
      if (max && days > max)
        stuck.push({
          id: c.id, title: c.fullName,
          detail: `${STAGE_LABEL[c.stage as Stage]} for ${days} days (limit ${max})`,
          href: `/candidates/${c.id}`, tone: days > max * 1.5 ? "danger" : "warn", when: c.stageEnteredAt,
        });
    }
    groups.push({ key: "stuck", title: "Too long in one stage", items: stuck });
    groups.push({ key: "checkins", title: "Post-arrival check-ins", items: checkIns });
  }

  if (can(user.role, "stage.update") || can(user.role, "candidate.edit")) {
    const months = num(s.passportAlertMonths, 12);
    const cands = await db.candidate.findMany({
      where: {
        ...(can(user.role, "stage.update") ? {} : scope),
        status: { in: ["INTERESTED", "ENROLLED", "IN_PROCESS"] },
        passportExpiry: { not: null },
      },
      select: { id: true, fullName: true, passportExpiry: true, jobOrder: { select: { contractMonths: true } } },
    });
    const items: AlertItem[] = [];
    for (const c of cands) {
      const limit = addMonths(r.now, months);
      const contractEnd = addMonths(r.now, c.jobOrder?.contractMonths ?? 0);
      const exp = c.passportExpiry!;
      if (exp < limit || exp < contractEnd) {
        const reason = exp < r.now ? "expired" : exp < limit ? `expires within ${months} months` : "expires before contract ends";
        items.push({
          id: c.id, title: c.fullName, detail: `Passport ${reason} (${d(exp)})`,
          href: `/candidates/${c.id}`, tone: exp < addMonths(r.now, 6) ? "danger" : "warn", when: exp,
        });
      }
    }
    groups.push({ key: "passports", title: "Passport expiry", items: items.sort((a, b) => +a.when! - +b.when!) });
  }

  // --- partners
  if (can(user.role, "partners.manage") || can(user.role, "partners.finance")) {
    const ags = await db.partnerAgreement.findMany({
      where: { expiresOn: { not: null, lte: addDays(r.now, 60) } },
      include: { partner: { select: { id: true, name: true } } },
      orderBy: { expiresOn: "asc" },
    });
    const followUps = await db.partner.findMany({
      where: { nextFollowUp: { lte: r.todayEnd }, status: "ACTIVE" },
      select: { id: true, name: true, nextFollowUp: true },
    });
    groups.push({
      key: "partners",
      title: "Partner agreements & follow-ups",
      items: [
        ...ags
          .filter((a) => a.expiresOn! <= addDays(r.now, a.remindDays))
          .map((a) => ({
            id: a.id, title: `${a.partner.name} · ${a.title}`,
            detail: a.expiresOn! < r.now ? `Expired ${relDays(a.expiresOn)}` : `Expires ${relDays(a.expiresOn)}`,
            href: `/partners/${a.partner.id}`, tone: (a.expiresOn! < r.now ? "danger" : "warn") as AlertItem["tone"], when: a.expiresOn,
          })),
        ...followUps.map((p) => ({
          id: p.id, title: p.name, detail: `Follow-up due ${relDays(p.nextFollowUp)}`,
          href: `/partners/${p.id}`, tone: "plain" as const, when: p.nextFollowUp,
        })),
      ],
    });
  }

  // --- office bills
  if (can(user.role, "expenses.manage")) {
    const bills = await db.bill.findMany({ where: { status: "UNPAID", dueDate: { lte: r.in30 } }, orderBy: { dueDate: "asc" } });
    groups.push({
      key: "bills",
      title: "Office bills",
      items: bills
        .filter((b) => b.dueDate <= addDays(r.todayEnd, b.remindDays))
        .map((b) => ({
          id: b.id, title: b.name, detail: `${money(b.amount)} due ${relDays(b.dueDate)}`,
          href: `/expenses/bills`, tone: b.dueDate < r.todayStart ? "danger" : "warn", when: b.dueDate,
        })),
    });
  }

  // --- approvals
  const approvals: AlertItem[] = [];
  if (can(user.role, "refund.approve")) {
    const pending = await db.refund.findMany({ where: { status: "PENDING" }, include: { candidate: { select: { fullName: true } } } });
    approvals.push(...pending.map((p) => ({
      id: p.id, title: `Refund · ${p.candidate.fullName}`, detail: `${money(p.policyAmount)} waiting approval`,
      href: `/finance/refunds`, tone: "warn" as const, when: p.createdAt,
    })));
  }
  if (can(user.role, "refund.pay")) {
    const approved = await db.refund.findMany({ where: { status: "APPROVED" }, include: { candidate: { select: { fullName: true } } } });
    approvals.push(...approved.map((p) => ({
      id: p.id, title: `Refund to pay · ${p.candidate.fullName}`, detail: `${money(p.policyAmount)} approved ${relDays(p.approvedAt)}`,
      href: `/finance/refunds`, tone: "plain" as const, when: p.approvedAt,
    })));
  }
  if (can(user.role, "expenses.approve")) {
    const n = await db.expense.findMany({ where: { status: "PENDING" }, select: { id: true, amount: true, category: true, date: true } });
    approvals.push(...n.map((e) => ({
      id: e.id, title: "Expense to approve", detail: `${money(e.amount)} on ${d(e.date)}`,
      href: `/expenses/list?status=PENDING`, tone: "plain" as const, when: e.date,
    })));
  }
  if (can(user.role, "payroll.approve")) {
    const n = await db.payroll.count({ where: { status: "DRAFT" } });
    if (n) approvals.push({ id: "payroll", title: "Payroll drafts", detail: `${n} salary sheets waiting review`, href: "/staff/payroll", tone: "plain" });
  }
  if (approvals.length) groups.push({ key: "approvals", title: "Waiting for approval", items: approvals });

  return groups;
}

export function alertCount(groups: AlertGroup[]) {
  return groups.reduce((s, g) => s + g.items.length, 0);
}
