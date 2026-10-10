import Link from "next/link";
import { eachDayOfInterval, endOfDay, endOfMonth, startOfDay, startOfMonth, format } from "date-fns";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { monthFromKey, monthKey, parseDateInput, toDateInput } from "@/lib/dates";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { d } from "@/lib/format";
import { Empty, Money, PageHeader, Section, TableWrap, btn, cx } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { FinanceTabs } from "../tabs";

export const metadata = { title: "Daily collections" };

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ day?: string; month?: string }> }) {
  const user = await requirePage("finance.view");
  const sp = await searchParams;
  const day = parseDateInput(sp.day ?? null) ?? new Date();
  const mk = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : monthKey(day);
  const m = monthFromKey(mk);

  const [dayPays, monthPays, refunds] = await Promise.all([
    db.payment.findMany({
      where: { date: { gte: startOfDay(day), lte: endOfDay(day) } },
      orderBy: { date: "asc" },
      include: { candidate: { select: { id: true, fullName: true, code: true } }, receivedBy: { select: { name: true } } },
    }),
    db.payment.findMany({ where: { date: { gte: startOfMonth(m), lte: endOfMonth(m) } }, select: { date: true, amount: true, method: true } }),
    db.refund.findMany({ where: { status: "PAID", refundedOn: { gte: startOfMonth(m), lte: endOfMonth(m) } }, select: { refundedOn: true, policyAmount: true, refundMethod: true } }),
  ]);

  const methods = PAYMENT_METHODS.map((x) => x.value);
  const byDay = eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) })
    .filter((x) => x <= new Date())
    .map((date) => {
      const key = format(date, "yyyy-MM-dd");
      const ps = monthPays.filter((p) => format(p.date, "yyyy-MM-dd") === key);
      const out = refunds.filter((f) => f.refundedOn && format(f.refundedOn, "yyyy-MM-dd") === key).reduce((s, f) => s + f.policyAmount, 0);
      const per = Object.fromEntries(methods.map((mt) => [mt, ps.filter((p) => p.method === mt).reduce((s, p) => s + p.amount, 0)]));
      return { date, key, per, total: ps.reduce((s, p) => s + p.amount, 0), count: ps.length, refunds: out };
    })
    .reverse();
  const shownMethods = methods.filter((mt) => byDay.some((r) => r.per[mt]! > 0));
  const dayTotal = (mt?: string) => dayPays.filter((p) => !mt || p.method === mt).reduce((s, p) => s + p.amount, 0);
  const bankLike = dayPays.filter((p) => p.method !== "CASH");

  return (
    <>
      <PageHeader title="Daily collections" meta="Cash and bank totals per day, to check against the cash box and the bank statement." />
      <FinanceTabs active="collections" role={user.role} />
      <FilterForm>
        <label className="text-[12.5px] text-muted">Day<input type="date" name="day" defaultValue={toDateInput(day)} className="control mt-0.5" /></label>
        <label className="text-[12.5px] text-muted">Month<input type="month" name="month" defaultValue={mk} className="control mt-0.5" /></label>
        <a className={btn("secondary")} href={`/api/export/collections?month=${mk}`}>Export month</a>
        <Link className={btn("secondary")} href={`/print/collections?day=${toDateInput(day)}`} target="_blank">Print day sheet</Link>
      </FilterForm>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title={`Day sheet: ${d(day, "EEEE d MMM yyyy")}`} flush>
          <div className="grid grid-cols-3 border-b border-rule">
            <div className="px-4 py-3 border-r border-rule"><div className="label-caps">Cash in hand</div><div className="num text-[20px]"><Money v={dayTotal("CASH")} /></div></div>
            <div className="px-4 py-3 border-r border-rule"><div className="label-caps">Bank / card / cheque</div><div className="num text-[20px]"><Money v={dayTotal() - dayTotal("CASH")} /></div></div>
            <div className="px-4 py-3"><div className="label-caps">Total</div><div className="num text-[20px] font-medium"><Money v={dayTotal()} /></div></div>
          </div>
          {dayPays.length === 0 ? <Empty>No payments on this day.</Empty> : (
            <TableWrap>
              <table className="grid-table">
                <thead><tr><th>Time</th><th>Receipt</th><th>Candidate</th><th>Method</th><th>Received by</th><th className="r">Amount</th></tr></thead>
                <tbody>
                  {dayPays.map((p) => (
                    <tr key={p.id}>
                      <td className="num text-muted">{d(p.date, "HH:mm")}</td>
                      <td className="num"><Link className="link" href={`/print/receipt/${p.id}`} target="_blank">{p.receiptNo}</Link></td>
                      <td><Link className="row-link" href={`/candidates/${p.candidate.id}`}>{p.candidate.fullName}</Link></td>
                      <td>{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL]}{p.reference && <div className="num text-[12px] text-muted">{p.reference}</div>}</td>
                      <td>{p.receivedBy.name}</td>
                      <td className="r"><Money v={p.amount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
          {bankLike.length > 0 && <p className="px-4 py-2 text-[12.5px] text-muted border-t border-rule">{bankLike.length} non-cash payments with references above. Tick them off against the bank statement.</p>}
        </Section>

        <Section title={`Month: ${d(m, "MMMM yyyy")}`} flush>
          <TableWrap>
            <table className="grid-table">
              <thead><tr><th>Date</th>{shownMethods.map((mt) => <th key={mt} className="r">{PAYMENT_METHOD_LABEL[mt as keyof typeof PAYMENT_METHOD_LABEL]}</th>)}<th className="r">Total</th><th className="r">Refunds out</th></tr></thead>
              <tbody>
                {byDay.map((r) => (
                  <tr key={r.key} className={cx(r.key === toDateInput(day) && "[&>td]:bg-mark/50")}>
                    <td className="whitespace-nowrap"><Link className="row-link" href={`/finance/collections?day=${r.key}&month=${mk}`}>{d(r.date, "EEE d")}</Link></td>
                    {shownMethods.map((mt) => <td key={mt} className="r"><Money v={r.per[mt]!} zero="—" /></td>)}
                    <td className="r font-medium"><Money v={r.total} zero="—" /></td>
                    <td className="r text-danger"><Money v={r.refunds} zero="" /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Month</td>
                  {shownMethods.map((mt) => <td key={mt} className="r"><Money v={byDay.reduce((s, r) => s + r.per[mt]!, 0)} /></td>)}
                  <td className="r"><Money v={byDay.reduce((s, r) => s + r.total, 0)} /></td>
                  <td className="r"><Money v={byDay.reduce((s, r) => s + r.refunds, 0)} zero="—" /></td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
        </Section>
      </div>
    </>
  );
}
