import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ranges } from "@/lib/dates";
import { getDueInstallments, type DueItem } from "@/lib/dues";
import { computeLedger } from "@/lib/ledger";
import { PAYING_STATUSES } from "@/lib/constants";
import { d, money, relDays } from "@/lib/format";
import { Empty, Figure, Figures, Money, PageHeader, Section, TableWrap, cx } from "@/components/ui";
import { ContactButtons, RemindButton } from "@/components/contact";
import { reminderWriter } from "@/lib/reminder";
import { FilterForm } from "@/components/filter-form";
import { FinanceTabs } from "./tabs";

export const metadata = { title: "Fees & collections" };

function DueTable({ rows, today, write }: { rows: DueItem[]; today: Date; write: (x: DueItem) => string }) {
  if (!rows.length) return <Empty>Nothing here.</Empty>;
  return (
    <TableWrap>
      <table className="grid-table">
        <thead><tr><th>Candidate</th><th>Installment</th><th>Due</th><th>Staff</th><th className="r">Due now</th><th className="r">Total balance</th><th></th></tr></thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.installmentId}>
              <td><Link className="row-link" href={`/candidates/${x.candidateId}`}>{x.name}</Link><div className="text-[12px] text-muted"><span className="num">{x.code}</span>{x.jobOrder ? ` · ${x.jobOrder}` : ""}</div></td>
              <td className="text-[13px]">{x.label}</td>
              <td className={cx("whitespace-nowrap", x.dueDate < today && "text-danger")}>{d(x.dueDate, "d MMM")}<div className="text-[12px]">{relDays(x.dueDate)}</div></td>
              <td className="text-[13px]">{x.assignedTo ?? "—"}</td>
              <td className="r font-medium"><Money v={x.outstanding} /></td>
              <td className="r text-muted"><Money v={x.balance} /></td>
              <td className="text-right whitespace-nowrap"><span className="inline-flex gap-1.5"><RemindButton phone={x.whatsapp || x.phone} text={write(x)} candidateId={x.candidateId} /><ContactButtons phone={x.phone} whatsapp={x.whatsapp} /></span></td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={4}>{rows.length} installments</td><td className="r"><Money v={rows.reduce((s, x) => s + x.outstanding, 0)} /></td><td colSpan={2}></td></tr></tfoot>
      </table>
    </TableWrap>
  );
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ staff?: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "finance.view") && !can(user.role, "payment.record")) redirect("/");
  const sp = await searchParams;
  const all = can(user.role, "finance.view");
  const staffId = all ? sp.staff || undefined : user.id;
  const r = ranges();

  const [dues, todayPays, monthPays, openCands, staff] = await Promise.all([
    getDueInstallments({ until: r.weekEnd, assignedToId: staffId }),
    db.payment.aggregate({ where: { date: { gte: r.todayStart, lte: r.todayEnd }, ...(staffId ? { candidate: { assignedToId: staffId } } : {}) }, _sum: { amount: true }, _count: true }),
    db.payment.aggregate({ where: { date: { gte: r.monthStart, lte: r.todayEnd }, ...(staffId ? { candidate: { assignedToId: staffId } } : {}) }, _sum: { amount: true }, _count: true }),
    db.candidate.findMany({
      where: { status: { in: PAYING_STATUSES }, ...(staffId ? { assignedToId: staffId } : {}) },
      select: { agreedAmount: true, status: true, installments: true, payments: { select: { amount: true } } },
    }),
    all ? db.user.findMany({ where: { active: true, role: { in: ["SALES", "MANAGEMENT", "OPERATIONS"] } }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const write = await reminderWriter(user.name);
  const outstanding = openCands.reduce((s, c) => s + computeLedger(c).balance, 0);
  const overdue = dues.filter((x) => x.dueDate < r.todayStart);
  const today = dues.filter((x) => x.dueDate >= r.todayStart && x.dueDate <= r.todayEnd);
  const week = dues.filter((x) => x.dueDate > r.todayEnd);

  return (
    <>
      <PageHeader title="Fees & collections" meta={all ? "Candidate fees across the office" : "Candidates you follow"} />
      <FinanceTabs active="due" role={user.role} />
      {all && (
        <FilterForm>
          <select name="staff" defaultValue={sp.staff ?? ""} className="control !w-[220px]">
            <option value="">All staff</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </FilterForm>
      )}
      <Figures cols={5}>
        <Figure label="Collected today" value={money(todayPays._sum.amount ?? 0, { cur: false })} sub={`${todayPays._count} receipts`} tone="green" href={all ? "/finance/collections" : undefined} />
        <Figure label="This month" value={money(monthPays._sum.amount ?? 0, { cur: false })} sub={`${monthPays._count} receipts`} />
        <Figure label="Overdue" value={money(overdue.reduce((s, x) => s + x.outstanding, 0), { cur: false })} sub={`${overdue.length} installments`} tone={overdue.length ? "red" : undefined} />
        <Figure label="Due rest of week" value={money([...today, ...week].reduce((s, x) => s + x.outstanding, 0), { cur: false })} sub={`${today.length + week.length} installments`} tone="amber" />
        <Figure label="Total still owed" value={money(outstanding, { cur: false, whole: true })} sub={`${openCands.length} open ledgers`} />
      </Figures>
      <div className="space-y-5 mt-5">
        <Section title="Overdue" note="oldest first" flush><DueTable rows={overdue} today={r.todayStart} write={write} /></Section>
        <Section title="Due today" flush><DueTable rows={today} today={r.todayStart} write={write} /></Section>
        <Section title="Due later this week" note={`until ${d(r.weekEnd, "EEE d MMM")}`} flush><DueTable rows={week} today={r.todayStart} write={write} /></Section>
      </div>
    </>
  );
}
