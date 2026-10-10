import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { STAGE_SHORT, type Stage } from "@/lib/constants";
import { Disclose, Empty, Field, Input, Money, PageHeader, Section, Select, TableWrap, Tag } from "@/components/ui";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { FinanceTabs } from "../tabs";
import { deleteFeeRule, saveFeeRule, savePackage, togglePackage } from "../actions";
import { PackageForm } from "./package-form";

export const metadata = { title: "Fee packages" };

export default async function PackagesPage() {
  const user = await requirePage("finance.view");
  const edit = can(user.role, "packages.manage");
  const [packages, rules, jobs] = await Promise.all([
    db.feePackage.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { steps: { orderBy: { sequence: "asc" } }, jobOrder: { select: { reference: true } }, _count: { select: { candidates: true } } },
    }),
    db.feeRule.findMany({ orderBy: [{ side: "asc" }, { country: "asc" }] }),
    db.jobOrder.findMany({ orderBy: { receivedOn: "desc" }, select: { id: true, reference: true, position: true, country: true } }),
  ]);
  const jobOpts = jobs.map((j) => ({ value: j.id, label: `${j.reference} · ${j.position}, ${j.country}` }));

  return (
    <>
      <PageHeader title="Fee packages & limits" meta="Each enrolled candidate's installment plan is built from one of these packages." />
      <FinanceTabs active="packages" role={user.role} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5 min-w-0">
          {packages.map((p) => (
            <Section key={p.id} title={<>{p.name} {!p.active && <Tag tone="faint">retired</Tag>}</>} note={p.jobOrder?.reference ?? p.country ?? ""}
              actions={<><span className="num font-medium">AED <Money v={p.totalAmount} /></span>{edit && <ActionButton action={togglePackage.bind(null, p.id)} variant="ghost">{p.active ? "Retire" : "Re-activate"}</ActionButton>}</>}
              flush>
              <TableWrap>
                <table className="grid-table">
                  <tbody>
                    {p.steps.map((s) => (
                      <tr key={s.id}>
                        <td className="num text-muted w-8">{s.sequence}</td>
                        <td>{s.label}</td>
                        <td className="text-muted text-[13px]">{s.stage ? `due ${STAGE_SHORT[s.stage as Stage].toLowerCase()}` : s.dueAfterDays ? `${s.dueAfterDays} days after enrolment` : "on enrolment"}</td>
                        <td className="r"><Money v={s.amount} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              <div className="px-4 py-2 text-[12.5px] text-muted border-t border-rule flex flex-wrap justify-between gap-2">
                <span>{p._count.candidates} candidates on this package</span>
                {p.refundPolicy && <span className="max-w-[560px]">Refund: {p.refundPolicy}</span>}
              </div>
              {edit && (
                <div className="p-3 border-t border-rule">
                  <Disclose label="Change package">
                    <div className="pt-2">
                      <PackageForm action={savePackage.bind(null, p.id)} jobs={jobOpts} defaults={{
                        name: p.name, jobOrderId: p.jobOrderId ?? "", country: p.country ?? "", refundPolicy: p.refundPolicy ?? "",
                        steps: p.steps.map((s) => ({ label: s.label, amount: String(s.amount), when: s.stage ?? "DAYS", days: String(s.dueAfterDays ?? "") })),
                      }} />
                    </div>
                  </Disclose>
                </div>
              )}
            </Section>
          ))}
          {packages.length === 0 && <Section><Empty>No packages yet.</Empty></Section>}
          {edit && (
            <Section title="New package">
              <PackageForm action={savePackage.bind(null, null)} jobs={jobOpts} />
            </Section>
          )}
        </div>

        <div className="space-y-5">
          <Section title="Fee limits" note="company policy & country rules" flush>
            {rules.length === 0 ? <Empty>No limits set.</Empty> : (
              <ul className="divide-y divide-rule">
                {rules.map((r) => (
                  <li key={r.id} className="px-4 py-2.5 text-[13px]">
                    <div className="flex justify-between gap-2">
                      <span><span className="font-medium">{r.country}</span> <Tag tone={r.side === "ORIGIN" ? "blue" : "plain"}>{r.side === "ORIGIN" ? "origin" : "destination"}</Tag></span>
                      <span className="num">max {r.maxAmount.toLocaleString()}</span>
                    </div>
                    {r.note && <div className="text-[12px] text-muted mt-0.5">{r.note}</div>}
                    {edit && <ActionButton action={deleteFeeRule.bind(null, r.id)} variant="ghost" className="!h-5 !px-0 text-[11.5px] text-muted" confirm="Remove this limit?">remove</ActionButton>}
                  </li>
                ))}
              </ul>
            )}
            <p className="px-4 py-2 text-[12px] text-muted border-t border-rule">A fee plan above a limit cannot be saved. Origin limits apply by candidate nationality.</p>
          </Section>
          {edit && (
            <Section title="Add or change a limit">
              <ActionForm action={saveFeeRule} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Country"><Input name="country" required /></Field>
                  <Field label="Applies to"><Select name="side" options={[{ value: "DESTINATION", label: "Destination" }, { value: "ORIGIN", label: "Origin (nationality)" }]} /></Field>
                </div>
                <Field label="Maximum total fee (AED)"><Input name="maxAmount" className="num" required /></Field>
                <Field label="Source / note"><Input name="note" placeholder="Regulation or policy reference" /></Field>
                <Submit size="sm">Save limit</Submit>
              </ActionForm>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
