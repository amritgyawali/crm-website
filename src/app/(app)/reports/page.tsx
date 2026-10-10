import { requirePage } from "@/lib/auth";
import { monthKey } from "@/lib/dates";
import { PageHeader, Section, btn } from "@/components/ui";

export const metadata = { title: "Reports & export" };

const REPORTS = [
  { key: "candidates", name: "Candidates", desc: "Every candidate with status, stage, source, staff and fee balance." },
  { key: "dues", name: "Fees due this month", desc: "Installments still owed up to the end of this month, with phone numbers." },
  { key: "payments", name: "Payments (this month)", desc: "Each receipt with method, reference and who received it." },
  { key: "collections", name: "Daily collections", desc: "Cash, bank, card and cheque totals per day for the month.", month: true },
  { key: "calls", name: "Call log", desc: "All calls in the month with outcome and next call date.", month: true },
  { key: "campaigns", name: "Campaign results", desc: "Leads, enrolments, deployments, spend and cost per enrolment." },
  { key: "partners", name: "Partners", desc: "Deployments, money owed both ways and agreement expiry." },
  { key: "expenses", name: "Expenses", desc: "One-time office expenses for the month.", month: true },
  { key: "monthly", name: "Monthly income and costs", desc: "Twelve months of income collected minus costs paid." },
  { key: "audit", name: "Activity log", desc: "Who changed what, including edited or deleted payments." },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePage("reports.view");
  const mk = (await searchParams).month ?? monthKey();
  return (
    <>
      <PageHeader title="Reports & export" meta="Excel files open directly in Excel or Google Sheets. For PDF, open the printable pages and choose “Save as PDF”." />
      <form className="mb-4 flex items-end gap-2">
        <label className="text-[12.5px] text-muted">Month for monthly reports<input type="month" name="month" defaultValue={mk} className="control mt-0.5 !w-[180px]" /></label>
        <button className={btn("secondary")}>Use month</button>
      </form>
      <Section flush>
        <ul className="divide-y divide-rule">
          {REPORTS.map((r) => {
            const qs = r.month ? `?month=${mk}` : "";
            return (
              <li key={r.key} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-[14px]">{r.name}{r.month && <span className="text-muted font-normal text-[12.5px]"> · {mk}</span>}</div>
                  <div className="text-[13px] text-muted">{r.desc}</div>
                </div>
                <div className="flex gap-2">
                  <a className={btn("secondary", "sm")} href={`/api/export/${r.key}${qs}`}>Excel</a>
                  <a className={btn("ghost", "sm")} href={`/api/export/${r.key}${qs}${qs ? "&" : "?"}format=csv`}>CSV</a>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title="Printable pages" className="mt-5">
        <ul className="text-[13.5px] space-y-1.5 list-disc pl-5">
          <li>Payment receipt: open any payment and press “Receipt”.</li>
          <li>Candidate statement: on a candidate&apos;s fee ledger, “Print statement”.</li>
          <li>Collection day sheet: Fees &amp; collections → Daily collections → “Print day sheet”.</li>
        </ul>
      </Section>
    </>
  );
}
