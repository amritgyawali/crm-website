import { amountInWords, d, dt, money } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";

export type ReceiptData = {
  receiptNo: string;
  date: Date;
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
  createdAt: Date;
  receivedBy: { name: string };
  candidate: { fullName: string; code: string; passportNo: string | null; phone: string; jobOrder: { position: string; country: string } | null; feePackage: { name: string } | null };
};

const maskEnd = (s: string, keep: number) => (s.length <= keep ? s : "•".repeat(Math.min(s.length - keep, 6)) + s.slice(-keep));
const maskPhone = (s: string) => (s.length < 8 ? s : s.slice(0, 4) + "•".repeat(s.length - 7) + s.slice(-3));

export function Receipt({
  p, company, balanceAfter, paidToDate, agreed, masked = false,
}: {
  /** Public link: hide most of the passport and phone number. */
  masked?: boolean;
  p: ReceiptData;
  company: { name: string; address: string; phone: string; email: string; trn: string };
  balanceAfter: number;
  paidToDate: number;
  agreed: number;
}) {
  return (
    <article className="bg-white w-full max-w-[720px] mx-auto border border-rule-2 p-8 sm:p-10 print:border-0 print:p-0 text-[13.5px]">
      <header className="flex flex-wrap justify-between gap-6 pb-5 border-b-2 border-ink">
        <div>
          <div className="font-serif text-[22px] font-semibold leading-tight">{company.name}</div>
          <div className="text-muted mt-1 max-w-[320px]">{company.address}</div>
          <div className="text-muted">{company.phone} · {company.email}</div>
          {company.trn && <div className="text-muted">TRN {company.trn}</div>}
        </div>
        <div className="text-right">
          <div className="label-caps">Payment receipt</div>
          <div className="num text-[20px] font-medium mt-1">{p.receiptNo}</div>
          <div className="mt-1">{d(p.date, "d MMMM yyyy")}</div>
        </div>
      </header>

      <section className="grid sm:grid-cols-2 gap-6 py-6 border-b border-rule">
        <div>
          <div className="label-caps mb-1">Received from</div>
          <div className="text-[16px] font-medium">{p.candidate.fullName}</div>
          <div className="text-muted num">{p.candidate.code}{p.candidate.passportNo ? ` · Passport ${masked ? maskEnd(p.candidate.passportNo, 3) : p.candidate.passportNo}` : ""}</div>
          <div className="text-muted num">{masked ? maskPhone(p.candidate.phone) : p.candidate.phone}</div>
        </div>
        <div>
          <div className="label-caps mb-1">Towards</div>
          <div>{p.candidate.feePackage?.name ?? "Recruitment service fee"}</div>
          {p.candidate.jobOrder && !p.candidate.feePackage?.name.startsWith(p.candidate.jobOrder.position) && <div className="text-muted">{p.candidate.jobOrder.position}, {p.candidate.jobOrder.country}</div>}
        </div>
      </section>

      <section className="py-6 border-b border-rule">
        <div className="flex items-baseline justify-between gap-4">
          <span className="label-caps">Amount received</span>
          <span className="num text-[28px] font-medium">{money(p.amount)}</span>
        </div>
        <div className="mt-2 italic text-ink-2">{amountInWords(p.amount)} only.</div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <div><dt className="label-caps">Method</dt><dd>{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL] ?? p.method}</dd></div>
          <div><dt className="label-caps">Reference</dt><dd className="num">{p.reference ?? "—"}</dd></div>
          <div><dt className="label-caps">Paid to date</dt><dd className="num">{money(paidToDate)}</dd></div>
          <div><dt className="label-caps">Balance</dt><dd className="num font-medium">{agreed ? money(balanceAfter) : "—"}</dd></div>
        </dl>
        {p.note && <p className="mt-4 text-muted">Note: {p.note}</p>}
      </section>

      <footer className="pt-10 grid grid-cols-2 gap-10">
        <div>
          <div className="border-t border-ink pt-1.5">Received by: {p.receivedBy.name}</div>
        </div>
        <div>
          <div className="border-t border-ink pt-1.5">Candidate signature</div>
        </div>
      </footer>
      <p className="mt-8 text-[11.5px] text-muted">
        Computer-generated receipt, recorded {dt(p.createdAt)}. Keep it for your records. Fees are refundable only as per the signed agreement.
      </p>
    </article>
  );
}
