import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { endOfDay, startOfMonth } from "date-fns";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { parseDateInput, toDateInput } from "@/lib/dates";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { d } from "@/lib/format";
import { Empty, Input, Money, PageHeader, Section, Select, TableWrap, btn } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { Pager } from "@/components/pager";
import { FinanceTabs } from "../tabs";
import { RowNav } from "@/components/row-nav";

export const metadata = { title: "All payments" };
const PER = 100;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; method?: string; staff?: string; q?: string; page?: string }> }) {
  const user = await requirePage("finance.view");
  const sp = await searchParams;
  const from = parseDateInput(sp.from ?? null) ?? startOfMonth(new Date());
  const to = parseDateInput(sp.to ?? null) ?? new Date();
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.PaymentWhereInput = { date: { gte: from, lte: endOfDay(to) } };
  if (sp.method) where.method = sp.method;
  if (sp.staff) where.receivedById = sp.staff;
  if (sp.q) where.OR = [{ receiptNo: { contains: sp.q.toUpperCase() } }, { reference: { contains: sp.q } }, { candidate: { fullName: { contains: sp.q } } }];

  const [rows, agg, staff] = await Promise.all([
    db.payment.findMany({
      where, orderBy: { date: "desc" }, skip: (page - 1) * PER, take: PER,
      include: { candidate: { select: { id: true, fullName: true, code: true } }, receivedBy: { select: { name: true } } },
    }),
    db.payment.aggregate({ where, _sum: { amount: true }, _count: true }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const params = { ...sp, from: toDateInput(from), to: toDateInput(to) };

  return (
    <>
      <PageHeader title="All payments" meta={<><span className="num">{agg._count}</span> receipts · <Money v={agg._sum.amount ?? 0} /> AED</>} />
      <FinanceTabs active="payments" role={user.role} />
      <FilterForm>
        <label className="text-[12.5px] text-muted">From<input type="date" name="from" defaultValue={toDateInput(from)} className="control mt-0.5" /></label>
        <label className="text-[12.5px] text-muted">To<input type="date" name="to" defaultValue={toDateInput(to)} className="control mt-0.5" /></label>
        <Select name="method" defaultValue={sp.method ?? ""} placeholder="Any method" options={PAYMENT_METHODS} className="!w-[150px]" />
        <Select name="staff" defaultValue={sp.staff ?? ""} placeholder="Received by anyone" options={staff.map((s) => ({ value: s.id, label: s.name }))} className="!w-[190px]" />
        <Input name="q" defaultValue={sp.q} placeholder="Receipt, reference, name" className="!w-[200px]" />
        <button className={btn("secondary")}>Search</button>
        <a className={btn("secondary")} href={`/api/export/payments?${new URLSearchParams(params as Record<string, string>)}`}>Export</a>
      </FilterForm>
      <Section flush>
        {rows.length === 0 ? <Empty>No payments in this period.</Empty> : (
          <RowNav><TableWrap>
            <table className="grid-table">
              <thead><tr><th>Date</th><th>Receipt</th><th>Candidate</th><th>Method</th><th>Reference</th><th>Received by</th><th className="r">Amount</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{d(p.date)}</td>
                    <td className="num"><Link className="link" href={`/print/receipt/${p.id}`} target="_blank">{p.receiptNo}</Link></td>
                    <td><Link className="row-link" href={`/candidates/${p.candidate.id}`}>{p.candidate.fullName}</Link> <span className="num text-[12px] text-muted">{p.candidate.code}</span></td>
                    <td>{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL]}</td>
                    <td className="num text-[12.5px]">{p.reference ?? "—"}</td>
                    <td>{p.receivedBy.name}</td>
                    <td className="r"><Money v={p.amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap></RowNav>
        )}
        <Pager page={page} pages={Math.ceil(agg._count / PER)} params={params} base="/finance/payments" />
      </Section>
    </>
  );
}
