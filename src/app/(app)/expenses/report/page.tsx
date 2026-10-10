import { requirePage } from "@/lib/auth";
import { lastMonths } from "@/lib/summary";
import { BILL_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/constants";
import { Money, PageHeader, Section, TableWrap, btn, cx } from "@/components/ui";
import { ExpenseTabs } from "../tabs";
import { MonthBars } from "@/components/month-bars";

export const metadata = { title: "Monthly report" };

export default async function ExpenseReport() {
  await requirePage("expenses.manage");
  const months = await lastMonths(6);
  type M = (typeof months)[number];
  type Row = { label: string; get: (m: M) => number; strong?: boolean };
  const all: Row[] = [
    { label: "Candidate fees", get: (m: M) => m.candidateIncome },
    { label: "Partner payments", get: (m: M) => m.partnerIncome },
    { label: "Refunds paid", get: (m: M) => -m.refundOut },
    { label: "Income", get: (m: M) => m.income, strong: true },
    ...BILL_CATEGORIES.map((c) => ({ label: c.label, get: (m: M) => m.billByCat[c.value] ?? 0 })),
    ...EXPENSE_CATEGORIES.map((c) => ({ label: c.label, get: (m: M) => m.expenseByCat[c.value] ?? 0 })),
    { label: "Salaries", get: (m: M) => m.salaries },
    { label: "Partner commission", get: (m: M) => m.commissions },
    { label: "Costs", get: (m: M) => m.costs, strong: true },
    { label: "Net", get: (m: M) => m.net, strong: true },
  ];
  const rows = all.filter((r) => r.strong || months.some((m) => r.get(m) !== 0));

  return (
    <>
      <PageHeader title="Monthly report" meta="Last six months, money actually received and paid." actions={<a className={btn("secondary")} href="/api/export/monthly">Export to Excel</a>} />
      <ExpenseTabs active="report" />
      <Section title="Income and costs" className="mb-5">
        <MonthBars data={months.map((m) => ({ label: m.label, a: m.income, b: m.costs }))} aLabel="Income" bLabel="Costs" />
      </Section>
      <Section flush>
        <TableWrap>
          <table className="grid-table">
            <thead><tr><th></th>{months.map((m) => <th key={m.key} className="r">{m.label}</th>)}<th className="r">Six months</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const total = months.reduce((s, m) => s + r.get(m), 0);
                return (
                  <tr key={r.label} className={cx(r.strong && "[&>td]:font-semibold [&>td]:bg-well/50")}>
                    <td className={cx(!r.strong && "pl-6")}>{r.label}</td>
                    {months.map((m) => <td key={m.key} className={cx("r", r.label === "Net" && r.get(m) < 0 && "text-danger")}><Money v={r.get(m)} zero="—" /></td>)}
                    <td className="r"><Money v={total} zero="—" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
