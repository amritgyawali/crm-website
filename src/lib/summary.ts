import { endOfMonth, startOfMonth, subMonths, format } from "date-fns";
import { db } from "./db";
import { round2 } from "./format";

/** Money in and out for one month, on a cash basis. */
export async function monthSummary(month: Date) {
  const from = startOfMonth(month), to = endOfMonth(month);
  const [cand, partnerIn, refunds, expenses, bills, payroll, partnerOut] = await Promise.all([
    db.payment.aggregate({ where: { date: { gte: from, lte: to } }, _sum: { amount: true } }),
    db.partnerEntry.aggregate({ where: { direction: "RECEIVABLE", kind: "PAYMENT", date: { gte: from, lte: to } }, _sum: { amount: true } }),
    db.refund.aggregate({ where: { status: "PAID", refundedOn: { gte: from, lte: to } }, _sum: { policyAmount: true } }),
    db.expense.groupBy({ by: ["category"], where: { status: "APPROVED", date: { gte: from, lte: to } }, _sum: { amount: true } }),
    db.bill.groupBy({ by: ["category"], where: { status: "PAID", paidOn: { gte: from, lte: to } }, _sum: { amount: true } }),
    db.payroll.aggregate({ where: { status: "PAID", paidOn: { gte: from, lte: to } }, _sum: { netPay: true } }),
    db.partnerEntry.aggregate({ where: { direction: "PAYABLE", kind: "PAYMENT", date: { gte: from, lte: to } }, _sum: { amount: true } }),
  ]);
  const candidateIncome = cand._sum.amount ?? 0;
  const partnerIncome = partnerIn._sum.amount ?? 0;
  const refundOut = refunds._sum.policyAmount ?? 0;
  const expenseByCat = Object.fromEntries(expenses.map((e) => [e.category, e._sum.amount ?? 0]));
  const billByCat = Object.fromEntries(bills.map((b) => [b.category, b._sum.amount ?? 0]));
  const expenseTotal = expenses.reduce((s, e) => s + (e._sum.amount ?? 0), 0);
  const billTotal = bills.reduce((s, b) => s + (b._sum.amount ?? 0), 0);
  const salaries = payroll._sum.netPay ?? 0;
  const commissions = partnerOut._sum.amount ?? 0;
  const income = round2(candidateIncome + partnerIncome - refundOut);
  const costs = round2(expenseTotal + billTotal + salaries + commissions);
  return {
    key: format(month, "yyyy-MM"), label: format(month, "MMM yyyy"),
    candidateIncome, partnerIncome, refundOut, income,
    expenseByCat, billByCat, expenseTotal, billTotal, salaries, commissions, costs,
    net: round2(income - costs),
  };
}

export async function lastMonths(n: number, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(await monthSummary(subMonths(now, i)));
  return out;
}
