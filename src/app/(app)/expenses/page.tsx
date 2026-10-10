import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { ranges } from "@/lib/dates";
import { monthSummary } from "@/lib/summary";
import { BILL_CATEGORY_LABEL, EXPENSE_CATEGORY_LABEL } from "@/lib/constants";
import { d, money } from "@/lib/format";
import { Figure, Figures, Money, PageHeader, Section } from "@/components/ui";
import { BillsTable } from "./bills-table";
import { ExpenseTabs } from "./tabs";

export const metadata = { title: "Office expenses" };

export default async function ExpensesOverview() {
  await requirePage("expenses.manage");
  const r = ranges();
  const [sum, overdue, next7, next30, pending] = await Promise.all([
    monthSummary(r.now),
    db.bill.findMany({ where: { status: "UNPAID", dueDate: { lt: r.todayStart } }, orderBy: { dueDate: "asc" } }),
    db.bill.findMany({ where: { status: "UNPAID", dueDate: { gte: r.todayStart, lte: r.in7 } }, orderBy: { dueDate: "asc" } }),
    db.bill.findMany({ where: { status: "UNPAID", dueDate: { gt: r.in7, lte: r.in30 } }, orderBy: { dueDate: "asc" } }),
    db.expense.count({ where: { status: "PENDING" } }),
  ]);
  const line = (label: string, v: number, neg?: boolean) => (
    <div key={label} className="flex justify-between py-1.5 border-b border-dashed border-rule"><span>{label}</span><span className="num">{neg && v ? "−" : ""}<Money v={v} zero="—" /></span></div>
  );

  return (
    <>
      <PageHeader title="Office expenses" meta={`${d(r.now, "MMMM yyyy")}, cash basis`} />
      <ExpenseTabs active="overview" />
      <Figures cols={4}>
        <Figure label="Income collected" value={money(sum.income, { cur: false })} sub="candidates + partners − refunds" tone="green" />
        <Figure label="Costs paid" value={money(sum.costs, { cur: false })} sub="expenses, bills, salaries, commission" />
        <Figure label="Net this month" value={money(sum.net, { cur: false })} tone={sum.net < 0 ? "red" : "green"} />
        <Figure label="Bills overdue" value={overdue.length} sub={money(overdue.reduce((s, b) => s + b.amount, 0))} tone={overdue.length ? "red" : undefined} href="/expenses/bills" />
      </Figures>
      {pending > 0 && <p className="mt-3 text-[13px]"><Link className="link" href="/expenses/list?status=PENDING">{pending} expenses waiting for approval</Link></p>}

      <div className="grid gap-5 mt-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5 min-w-0">
          {overdue.length > 0 && <Section title="Overdue bills" flush><BillsTable bills={overdue} /></Section>}
          <Section title="Bills due in the next 7 days" flush><BillsTable bills={next7} empty="Nothing due this week." /></Section>
          <Section title="Due in 8 to 30 days" flush><BillsTable bills={next30} empty="Nothing else this month." /></Section>
        </div>
        <Section title={`Summary, ${d(r.now, "MMMM")}`}>
          <div className="text-[13.5px]">
            <div className="label-caps mb-1">Money in</div>
            {line("Candidate fees", sum.candidateIncome)}
            {line("Partner payments", sum.partnerIncome)}
            {line("Refunds paid out", sum.refundOut, true)}
            <div className="flex justify-between py-2 font-semibold"><span>Income</span><span className="num"><Money v={sum.income} /></span></div>
            <div className="label-caps mt-3 mb-1">Money out</div>
            {Object.entries(sum.billByCat).map(([k, v]) => line(BILL_CATEGORY_LABEL[k as keyof typeof BILL_CATEGORY_LABEL] ?? k, v))}
            {Object.entries(sum.expenseByCat).map(([k, v]) => line(EXPENSE_CATEGORY_LABEL[k as keyof typeof EXPENSE_CATEGORY_LABEL] ?? k, v))}
            {line("Salaries", sum.salaries)}
            {line("Partner commission", sum.commissions)}
            <div className="flex justify-between py-2 font-semibold"><span>Costs</span><span className="num"><Money v={sum.costs} /></span></div>
            <div className="flex justify-between py-2 mt-1 border-t-2 border-ink font-semibold text-[15px]"><span>Net</span><span className={`num ${sum.net < 0 ? "text-danger" : ""}`}><Money v={sum.net} /></span></div>
          </div>
        </Section>
      </div>
    </>
  );
}
