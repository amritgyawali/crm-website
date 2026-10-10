import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { monthFromKey, monthKey } from "@/lib/dates";
import { d, money } from "@/lib/format";
import { Empty, Field, Input, Money, Notice, PageHeader, Section, TableWrap, Tag } from "@/components/ui";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { FilterForm } from "@/components/filter-form";
import { StaffTabs } from "../tabs";
import { approvePayroll, generatePayroll, markPayrollPaid, updatePayroll } from "../actions";

export const metadata = { title: "Payroll" };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requirePage("payroll.manage");
  const sp = await searchParams;
  const mk = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : monthKey();
  const rows = await db.payroll.findMany({ where: { month: mk }, include: { user: { select: { name: true, role: true } }, approvedBy: { select: { name: true } } }, orderBy: { user: { name: "asc" } } });
  const drafts = rows.filter((r) => r.status === "DRAFT").length;
  const approved = rows.filter((r) => r.status === "APPROVED").length;
  const total = rows.reduce((s, r) => s + r.netPay, 0);

  return (
    <>
      <PageHeader
        title="Payroll"
        meta={`${d(monthFromKey(mk), "MMMM yyyy")} · salary = base × paid days ÷ working days, then adjustments`}
        actions={
          <>
            <ActionButton action={generatePayroll.bind(null, mk)} size="md" confirm="Recalculate draft salary sheets from attendance?">{rows.length ? "Recalculate drafts" : "Calculate from attendance"}</ActionButton>
            {drafts > 0 && can(user.role, "payroll.approve") && <ActionButton action={approvePayroll.bind(null, mk)} variant="primary" size="md" confirm={`Approve ${drafts} salary sheets totalling ${money(total)}?`}>Approve all</ActionButton>}
            {approved > 0 && <ActionButton action={markPayrollPaid.bind(null, mk)} variant="primary" size="md" confirm="Mark approved salaries as paid?">Mark paid</ActionButton>}
          </>
        }
      />
      <StaffTabs active="payroll" role={user.role} />
      <FilterForm><input type="month" name="month" defaultValue={mk} className="control !w-[170px]" /></FilterForm>
      {drafts > 0 && !can(user.role, "payroll.approve") && <div className="mb-4"><Notice tone="blue">{drafts} drafts are waiting for management review.</Notice></div>}
      <Section flush>
        {rows.length === 0 ? <Empty>No salary sheets for this month yet. Calculate them from attendance.</Empty> : (
          <TableWrap>
            <table className="grid-table">
              <thead><tr><th>Staff</th><th className="r">Base</th><th className="r">Days</th><th className="r">Deductions</th><th className="r">Additions</th><th className="r">Net pay</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.user.name}{r.note && <div className="text-[12px] text-muted font-normal">{r.note}</div>}</td>
                    <td className="r"><Money v={r.baseSalary} /></td>
                    <td className="r num">{r.paidDays}<span className="text-muted">/{r.workingDays}</span></td>
                    <td className="r"><Money v={r.deductions} zero="—" /></td>
                    <td className="r"><Money v={r.additions} zero="—" /></td>
                    <td className="r font-semibold"><Money v={r.netPay} /></td>
                    <td>{r.status === "DRAFT" ? <Tag tone="amber">Draft</Tag> : r.status === "APPROVED" ? <Tag tone="blue">Approved</Tag> : <Tag tone="green">Paid {d(r.paidOn, "d MMM")}</Tag>}{r.approvedBy && <div className="text-[12px] text-muted">{r.approvedBy.name}</div>}</td>
                    <td className="text-right">
                      {r.status === "DRAFT" && (
                        <details className="relative inline-block text-left">
                          <summary className="list-none cursor-pointer link text-[13px] [&::-webkit-details-marker]:hidden">Adjust</summary>
                          <div className="absolute right-0 z-10 mt-1 w-[280px] bg-sheet border border-rule-2 p-3 shadow-[0_6px_18px_rgba(0,0,0,.08)]">
                            <ActionForm action={updatePayroll.bind(null, r.id)} reset={false} className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <Field label="Deductions"><Input name="deductions" className="num" defaultValue={String(r.deductions)} /></Field>
                                <Field label="Additions"><Input name="additions" className="num" defaultValue={String(r.additions)} /></Field>
                              </div>
                              <Field label="Reason"><Input name="note" defaultValue={r.note ?? ""} placeholder="Advance, overtime, bonus…" /></Field>
                              <Submit size="sm">Save</Submit>
                            </ActionForm>
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={5}>Total</td><td className="r"><Money v={total} /></td><td colSpan={2}></td></tr></tfoot>
            </table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}
