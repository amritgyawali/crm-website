import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { computeLedger } from "@/lib/ledger";
import { getSettings } from "@/lib/settings";
import { d, money } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, STAGE_LABEL, type Stage } from "@/lib/constants";
import { PrintBar } from "@/components/print-bar";
import { Money } from "@/components/ui";

export const metadata = { title: "Statement" };

export default async function StatementPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.candidate.findUnique({
    where: { id },
    include: { installments: true, payments: { orderBy: { date: "asc" } }, refunds: true, feePackage: true, jobOrder: true },
  });
  if (!c) notFound();
  const s = await getSettings();
  const L = computeLedger(c);
  const text = `${s.companyName}: account statement for ${c.fullName}. Agreed ${money(c.agreedAmount)}, paid ${money(L.paid)}, balance ${money(L.balance)}.${L.nextDue?.dueDate ? ` Next due ${d(L.nextDue.dueDate)}: ${money(L.nextDue.outstanding)}.` : ""}`;
  return (
    <>
      <PrintBar back={`/candidates/${c.id}`} share={{ phone: c.whatsapp || c.phone, text }} />
      <article className="bg-white max-w-[720px] mx-auto border border-rule-2 p-8 sm:p-10 print:border-0 print:p-0 text-[13.5px]">
        <header className="flex justify-between gap-6 pb-4 border-b-2 border-ink">
          <div>
            <div className="font-serif text-[20px] font-semibold">{s.companyName}</div>
            <div className="text-muted">{s.companyAddress}</div>
          </div>
          <div className="text-right"><div className="label-caps">Statement of account</div><div className="mt-1">{d(new Date(), "d MMMM yyyy")}</div></div>
        </header>
        <section className="py-4 border-b border-rule grid grid-cols-2 gap-4">
          <div><div className="font-medium text-[15px]">{c.fullName}</div><div className="text-muted num">{c.code} · {c.phone}</div></div>
          <div className="text-right">{c.feePackage?.name}<div className="text-muted">{c.jobOrder ? `${c.jobOrder.employer}, ${c.jobOrder.country}` : ""}</div></div>
        </section>
        <h3 className="label-caps mt-5 mb-1">Installment plan</h3>
        <table className="grid-table">
          <thead><tr><th>Installment</th><th>Due</th><th className="r">Amount</th><th className="r">Paid</th><th className="r">Outstanding</th></tr></thead>
          <tbody>{L.rows.map((r) => <tr key={r.id}><td>{r.label}</td><td>{r.dueDate ? d(r.dueDate) : r.stage ? `At ${STAGE_LABEL[r.stage as Stage].toLowerCase()}` : "—"}</td><td className="r"><Money v={r.amount} /></td><td className="r"><Money v={r.paid} zero="—" /></td><td className="r"><Money v={r.outstanding} zero="—" /></td></tr>)}</tbody>
        </table>
        <h3 className="label-caps mt-6 mb-1">Payments</h3>
        <table className="grid-table">
          <thead><tr><th>Date</th><th>Receipt</th><th>Method</th><th className="r">Amount</th></tr></thead>
          <tbody>{c.payments.map((p) => <tr key={p.id}><td>{d(p.date)}</td><td className="num">{p.receiptNo}</td><td>{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL]}</td><td className="r"><Money v={p.amount} /></td></tr>)}</tbody>
        </table>
        <dl className="mt-6 ml-auto w-[280px] text-[14px]">
          <div className="flex justify-between py-1"><dt>Agreed fee</dt><dd className="num">{money(c.agreedAmount)}</dd></div>
          <div className="flex justify-between py-1"><dt>Paid</dt><dd className="num">{money(L.paid)}</dd></div>
          {L.refunded > 0 && <div className="flex justify-between py-1"><dt>Refunded</dt><dd className="num">{money(-L.refunded)}</dd></div>}
          <div className="flex justify-between py-1.5 border-t-2 border-ink font-semibold"><dt>Balance</dt><dd className="num">{money(L.balance)}</dd></div>
        </dl>
      </article>
    </>
  );
}
