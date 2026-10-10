import { endOfDay, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { parseDateInput } from "@/lib/dates";
import { d } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { PrintBar } from "@/components/print-bar";
import { Money } from "@/components/ui";

export const metadata = { title: "Day sheet" };

export default async function DaySheet({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  await requirePage("finance.view");
  const day = parseDateInput((await searchParams).day ?? null) ?? new Date();
  const s = await getSettings();
  const pays = await db.payment.findMany({
    where: { date: { gte: startOfDay(day), lte: endOfDay(day) } }, orderBy: { date: "asc" },
    include: { candidate: { select: { fullName: true } }, receivedBy: { select: { name: true } } },
  });
  const sum = (m?: string) => pays.filter((p) => !m || p.method === m).reduce((x, p) => x + p.amount, 0);
  return (
    <>
      <PrintBar back="/finance/collections" />
      <article className="bg-white max-w-[720px] mx-auto border border-rule-2 p-8 print:border-0 print:p-0 text-[13px]">
        <header className="flex justify-between pb-3 border-b-2 border-ink">
          <div className="font-serif text-[18px] font-semibold">{s.companyName}</div>
          <div className="text-right"><div className="label-caps">Collection day sheet</div><div>{d(day, "EEEE d MMMM yyyy")}</div></div>
        </header>
        <table className="grid-table mt-4">
          <thead><tr><th>Receipt</th><th>Candidate</th><th>Method</th><th>Reference</th><th>By</th><th className="r">Amount</th><th>Checked</th></tr></thead>
          <tbody>{pays.map((p) => <tr key={p.id}><td className="num">{p.receiptNo}</td><td>{p.candidate.fullName}</td><td>{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL]}</td><td className="num">{p.reference ?? ""}</td><td>{p.receivedBy.name}</td><td className="r"><Money v={p.amount} /></td><td>☐</td></tr>)}</tbody>
        </table>
        <dl className="mt-5 ml-auto w-[300px]">
          {PAYMENT_METHODS.filter((m) => sum(m.value) > 0).map((m) => <div key={m.value} className="flex justify-between py-1"><dt>{m.label}</dt><dd><Money v={sum(m.value)} /></dd></div>)}
          <div className="flex justify-between py-1.5 border-t-2 border-ink font-semibold"><dt>Total</dt><dd><Money v={sum()} /></dd></div>
        </dl>
        <div className="grid grid-cols-2 gap-10 mt-14">
          <div className="border-t border-ink pt-1">Counted by</div>
          <div className="border-t border-ink pt-1">Checked against bank by</div>
        </div>
      </article>
    </>
  );
}
