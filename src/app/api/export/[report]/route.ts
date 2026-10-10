import { NextResponse, type NextRequest } from "next/server";
import { endOfDay, endOfMonth, startOfMonth, format } from "date-fns";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { computeLedger } from "@/lib/ledger";
import { getDueInstallments } from "@/lib/dues";
import { lastMonths } from "@/lib/summary";
import { monthFromKey, monthKey, parseDateInput } from "@/lib/dates";
import { toCsv, toXlsx, type Col } from "@/lib/export";
import {
  CALL_OUTCOME_LABEL, CANDIDATE_STATUS_LABEL, EXPENSE_CATEGORY_LABEL, LEAD_SOURCE_LABEL, PARTNER_TYPE_LABEL, PAYMENT_METHOD_LABEL,
  PLATFORM_LABEL, STAGE_LABEL, type Stage,
} from "@/lib/constants";
import { campaignReport } from "@/app/(app)/campaigns/report";
import { partnerTotals } from "@/app/(app)/partners/data";

type L = Record<string, string>;
const lab = (m: L, k: string | null | undefined) => (k ? m[k] ?? k : "");

export async function GET(req: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(user.role, "reports.view")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { report } = await params;
  const q = req.nextUrl.searchParams;
  const mk = q.get("month") && /^\d{4}-\d{2}$/.test(q.get("month")!) ? q.get("month")! : monthKey();
  const m = monthFromKey(mk);
  let cols: Col[] = [];
  let rows: Record<string, unknown>[] = [];
  let title = report;

  switch (report) {
    case "candidates": {
      const where: Prisma.CandidateWhereInput = {};
      if (q.get("status") && q.get("status") !== "OPEN") where.status = q.get("status")!;
      if (q.get("source")) where.leadSource = q.get("source")!;
      if (q.get("job")) where.jobOrderId = q.get("job")!;
      if (q.get("stage")) where.stage = q.get("stage")!;
      const list = await db.candidate.findMany({
        where, orderBy: { createdAt: "desc" },
        include: { jobOrder: true, assignedTo: true, campaign: true, sourcePartner: true, installments: true, payments: { select: { amount: true } } },
      });
      title = "Candidates";
      cols = [
        { header: "Code", key: "code" }, { header: "Name", key: "name", width: 26 }, { header: "Phone", key: "phone", width: 16 }, { header: "Nationality", key: "nat" },
        { header: "Passport", key: "pp" }, { header: "Passport expiry", key: "ppx", date: true }, { header: "Status", key: "status" }, { header: "Stage", key: "stage", width: 22 },
        { header: "Job order", key: "job", width: 30 }, { header: "Lead source", key: "src" }, { header: "Campaign / partner", key: "srcd", width: 28 }, { header: "Staff", key: "staff" },
        { header: "Agreed fee", key: "agreed", money: true }, { header: "Paid", key: "paid", money: true }, { header: "Balance", key: "bal", money: true }, { header: "Added", key: "added", date: true },
      ];
      rows = list.map((c) => {
        const l = computeLedger(c);
        return {
          code: c.code, name: c.fullName, phone: c.phone, nat: c.nationality, pp: c.passportNo, ppx: c.passportExpiry, status: lab(CANDIDATE_STATUS_LABEL, c.status),
          stage: c.stage ? STAGE_LABEL[c.stage as Stage] : "", job: c.jobOrder ? `${c.jobOrder.reference} ${c.jobOrder.position}` : "", src: lab(LEAD_SOURCE_LABEL, c.leadSource),
          srcd: c.campaign?.name ?? c.sourcePartner?.name ?? c.referredBy ?? "", staff: c.assignedTo?.name ?? "", agreed: c.agreedAmount, paid: l.paid, bal: l.balance, added: c.createdAt,
        };
      });
      break;
    }
    case "payments": {
      const from = parseDateInput(q.get("from")) ?? startOfMonth(new Date());
      const to = parseDateInput(q.get("to")) ?? new Date();
      const list = await db.payment.findMany({ where: { date: { gte: from, lte: endOfDay(to) } }, orderBy: { date: "asc" }, include: { candidate: true, receivedBy: true } });
      title = "Payments";
      cols = [{ header: "Date", key: "date", date: true }, { header: "Receipt", key: "rc" }, { header: "Candidate", key: "name", width: 26 }, { header: "Code", key: "code" }, { header: "Method", key: "method" }, { header: "Reference", key: "ref", width: 18 }, { header: "Received by", key: "by" }, { header: "Amount", key: "amt", money: true }];
      rows = list.map((p) => ({ date: p.date, rc: p.receiptNo, name: p.candidate.fullName, code: p.candidate.code, method: lab(PAYMENT_METHOD_LABEL, p.method), ref: p.reference, by: p.receivedBy.name, amt: p.amount }));
      break;
    }
    case "collections": {
      const list = await db.payment.findMany({ where: { date: { gte: startOfMonth(m), lte: endOfMonth(m) } }, select: { date: true, amount: true, method: true } });
      const days = [...new Set(list.map((p) => format(p.date, "yyyy-MM-dd")))].sort();
      title = `Collections ${mk}`;
      cols = [{ header: "Date", key: "d" }, { header: "Cash", key: "CASH", money: true }, { header: "Bank transfer", key: "BANK_TRANSFER", money: true }, { header: "Card", key: "CARD", money: true }, { header: "Cheque", key: "CHEQUE", money: true }, { header: "Other", key: "OTHER", money: true }, { header: "Total", key: "t", money: true }];
      rows = days.map((day) => {
        const ps = list.filter((p) => format(p.date, "yyyy-MM-dd") === day);
        const r: Record<string, unknown> = { d: day, t: ps.reduce((s, p) => s + p.amount, 0) };
        for (const k of ["CASH", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"]) r[k] = ps.filter((p) => p.method === k).reduce((s, p) => s + p.amount, 0);
        return r;
      });
      break;
    }
    case "dues": {
      const list = await getDueInstallments({ until: endOfMonth(new Date()) });
      title = "Fees due";
      cols = [{ header: "Candidate", key: "name", width: 26 }, { header: "Code", key: "code" }, { header: "Phone", key: "phone" }, { header: "Installment", key: "label", width: 28 }, { header: "Due", key: "due", date: true }, { header: "Due now", key: "out", money: true }, { header: "Total balance", key: "bal", money: true }, { header: "Staff", key: "staff" }];
      rows = list.map((x) => ({ name: x.name, code: x.code, phone: x.phone, label: x.label, due: x.dueDate, out: x.outstanding, bal: x.balance, staff: x.assignedTo }));
      break;
    }
    case "calls": {
      const list = await db.callLog.findMany({ where: { createdAt: { gte: startOfMonth(m), lte: endOfMonth(m) } }, orderBy: { createdAt: "asc" }, include: { user: true, candidate: true } });
      title = `Calls ${mk}`;
      cols = [{ header: "Date & time", key: "at", width: 18 }, { header: "Staff", key: "staff" }, { header: "Candidate", key: "name", width: 26 }, { header: "Outcome", key: "out", width: 18 }, { header: "Note", key: "note", width: 40 }, { header: "Next call", key: "next", date: true }];
      rows = list.map((l) => ({ at: format(l.createdAt, "yyyy-MM-dd HH:mm"), staff: l.user.name, name: l.candidate.fullName, out: lab(CALL_OUTCOME_LABEL, l.outcome), note: l.note, next: l.nextCallAt }));
      break;
    }
    case "campaigns": {
      const list = await campaignReport();
      title = "Campaigns";
      cols = [{ header: "Campaign", key: "name", width: 34 }, { header: "Platform", key: "pl" }, { header: "Job order", key: "job", width: 24 }, { header: "Start", key: "start", date: true }, { header: "End", key: "end", date: true }, { header: "Leads", key: "leads" }, { header: "Enrolled", key: "enr" }, { header: "Deployed", key: "dep" }, { header: "Spent", key: "spent", money: true }, { header: "Cost per enrolment", key: "cpe", money: true }, { header: "Collected", key: "col", money: true }];
      rows = list.map((r) => ({ name: r.c.name, pl: lab(PLATFORM_LABEL, r.c.platform), job: r.c.jobOrder?.reference ?? "", start: r.c.startDate, end: r.c.endDate, leads: r.leads, enr: r.enrolled, dep: r.deployed, spent: r.c.amountSpent, cpe: r.cpe, col: r.collected }));
      break;
    }
    case "expenses": {
      const list = await db.expense.findMany({ where: { date: { gte: startOfMonth(m), lte: endOfMonth(m) } }, orderBy: { date: "asc" }, include: { createdBy: true } });
      title = `Expenses ${mk}`;
      cols = [{ header: "Date", key: "date", date: true }, { header: "Category", key: "cat", width: 22 }, { header: "Note", key: "note", width: 36 }, { header: "Paid by", key: "by" }, { header: "Status", key: "st" }, { header: "Amount", key: "amt", money: true }];
      rows = list.map((e) => ({ date: e.date, cat: lab(EXPENSE_CATEGORY_LABEL, e.category), note: e.note, by: e.paidBy, st: e.status, amt: e.amount }));
      break;
    }
    case "monthly": {
      const list = await lastMonths(12);
      title = "Monthly summary";
      cols = [{ header: "Month", key: "m" }, { header: "Candidate fees", key: "ci", money: true }, { header: "Partner payments", key: "pi", money: true }, { header: "Refunds", key: "rf", money: true }, { header: "Income", key: "inc", money: true }, { header: "Bills", key: "bills", money: true }, { header: "Expenses", key: "exp", money: true }, { header: "Salaries", key: "sal", money: true }, { header: "Commission", key: "com", money: true }, { header: "Costs", key: "costs", money: true }, { header: "Net", key: "net", money: true }];
      rows = list.map((x) => ({ m: x.label, ci: x.candidateIncome, pi: x.partnerIncome, rf: -x.refundOut, inc: x.income, bills: x.billTotal, exp: x.expenseTotal, sal: x.salaries, com: x.commissions, costs: x.costs, net: x.net }));
      break;
    }
    case "partners": {
      const list = await partnerTotals();
      title = "Partners";
      cols = [{ header: "Partner", key: "name", width: 30 }, { header: "Country", key: "c" }, { header: "Type", key: "t", width: 20 }, { header: "Job orders", key: "j" }, { header: "Supplied", key: "s" }, { header: "Selected", key: "sel" }, { header: "Deployed", key: "dep" }, { header: "They owe us", key: "to", money: true }, { header: "We owe them", key: "wo", money: true }, { header: "Income", key: "inc", money: true }, { header: "Agreement expires", key: "exp", date: true }];
      rows = list.map((r) => ({ name: r.p.name, c: r.p.country, t: lab(PARTNER_TYPE_LABEL, r.p.type), j: r.jobs, s: r.supplied, sel: r.selected, dep: r.deployed, to: r.m.theyOweOut, wo: r.m.weOweOut, inc: r.income, exp: r.nextExpiry }));
      break;
    }
    case "audit": {
      if (!can(user.role, "audit.view")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      const list = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5000, include: { user: true } });
      title = "Activity log";
      cols = [{ header: "When", key: "at", width: 18 }, { header: "Who", key: "who" }, { header: "Action", key: "a" }, { header: "Record", key: "e" }, { header: "Summary", key: "s", width: 70 }];
      rows = list.map((l) => ({ at: format(l.createdAt, "yyyy-MM-dd HH:mm"), who: l.user?.name ?? "System", a: l.action, e: l.entity, s: l.summary }));
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  }

  await audit({ userId: user.id, action: "EXPORT", entity: "Report", summary: `Exported ${title} (${rows.length} rows)` });
  const stamp = format(new Date(), "yyyy-MM-dd");
  const name = `${title.replace(/\s+/g, "-").toLowerCase()}-${stamp}`;
  if (q.get("format") === "csv") {
    return new NextResponse("﻿" + toCsv(cols, rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
  }
  const buf = await toXlsx(title, cols, rows);
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"` },
  });
}
