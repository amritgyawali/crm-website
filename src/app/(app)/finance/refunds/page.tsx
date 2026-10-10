import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { toDateInput } from "@/lib/dates";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, REFUND_REASON_LABEL, STAGE_LABEL, type Stage } from "@/lib/constants";
import { d } from "@/lib/format";
import { Empty, Field, Input, Money, PageHeader, Section, Select, TableWrap } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { RefundTag } from "@/components/tags";
import { FinanceTabs } from "../tabs";
import { approveRefund, markRefundPaid } from "../actions";

export const metadata = { title: "Refunds" };

export default async function RefundsPage() {
  const user = await requirePage("finance.view");
  const refunds = await db.refund.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      candidate: { select: { id: true, fullName: true, code: true, feePackage: { select: { refundPolicy: true } } } },
      requestedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
  });
  const pending = refunds.filter((r) => r.status === "PENDING");
  const toPay = refunds.filter((r) => r.status === "APPROVED");
  const done = refunds.filter((r) => r.status === "PAID" || r.status === "REJECTED");

  return (
    <>
      <PageHeader title="Refunds" meta="Opened when a case is closed after payment. Management approves the amount; finance pays it." />
      <FinanceTabs active="refunds" role={user.role} />
      <div className="space-y-5">
        <Section title="Waiting for management approval" actions={<span className="num text-muted">{pending.length}</span>} flush>
          {pending.length === 0 ? <Empty>Nothing waiting.</Empty> : (
            <ul className="divide-y divide-rule">
              {pending.map((r) => (
                <li key={r.id} className="p-4 grid gap-4 lg:grid-cols-[1fr_420px]">
                  <div className="text-[13.5px]">
                    <Link className="row-link" href={`/candidates/${r.candidate.id}`}>{r.candidate.fullName}</Link> <span className="num text-[12px] text-muted">{r.candidate.code}</span>
                    <div className="mt-1">{REFUND_REASON_LABEL[r.reason as keyof typeof REFUND_REASON_LABEL]}{r.stageAtClose && ` at ${STAGE_LABEL[r.stageAtClose as Stage]}`} · opened by {r.requestedBy.name}, {d(r.createdAt)}</div>
                    <div className="mt-1">Paid so far <Money v={r.paidToDate} className="font-medium" /> · proposed refund <Money v={r.policyAmount} className="font-medium" /></div>
                    {r.note && <p className="text-muted mt-1">{r.note}</p>}
                    {r.candidate.feePackage?.refundPolicy && <p className="text-[12.5px] text-muted mt-2 border-l-2 border-rule-2 pl-2">Policy: {r.candidate.feePackage.refundPolicy}</p>}
                  </div>
                  {can(user.role, "refund.approve") ? (
                    <ActionForm action={approveRefund.bind(null, r.id)} className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Refund amount (AED)"><Input name="policyAmount" defaultValue={String(r.policyAmount)} className="num" /></Field>
                        <Field label="Note"><Input name="approvalNote" /></Field>
                      </div>
                      <div className="flex gap-2">
                        <Submit name="decision" value="APPROVE">Approve</Submit>
                        <Submit name="decision" value="REJECT" variant="danger">Reject</Submit>
                      </div>
                    </ActionForm>
                  ) : <p className="text-[13px] text-muted">Only management can approve refunds.</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Approved, to be paid" actions={<span className="num text-muted">{toPay.length}</span>} flush>
          {toPay.length === 0 ? <Empty>Nothing to pay.</Empty> : (
            <ul className="divide-y divide-rule">
              {toPay.map((r) => (
                <li key={r.id} className="p-4 grid gap-4 lg:grid-cols-[1fr_520px]">
                  <div className="text-[13.5px]">
                    <Link className="row-link" href={`/candidates/${r.candidate.id}`}>{r.candidate.fullName}</Link>
                    <div className="mt-1">Refund <Money v={r.policyAmount} className="font-medium" /> approved by {r.approvedBy?.name} on {d(r.approvedAt)}</div>
                    {r.approvalNote && <p className="text-muted">{r.approvalNote}</p>}
                  </div>
                  {can(user.role, "refund.pay") && (
                    <ActionForm action={markRefundPaid.bind(null, r.id)} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                      <Field label="Date"><Input type="date" name="refundedOn" defaultValue={toDateInput(new Date())} /></Field>
                      <Field label="Method"><Select name="method" options={PAYMENT_METHODS} defaultValue="BANK_TRANSFER" /></Field>
                      <Field label="Reference"><Input name="refundRef" /></Field>
                      <Submit>Mark paid</Submit>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Closed" flush>
          {done.length === 0 ? <Empty>No completed refunds yet.</Empty> : (
            <TableWrap>
              <table className="grid-table">
                <thead><tr><th>Candidate</th><th>Reason</th><th className="r">Paid in</th><th className="r">Refunded</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {done.map((r) => (
                    <tr key={r.id}>
                      <td><Link className="row-link" href={`/candidates/${r.candidate.id}`}>{r.candidate.fullName}</Link></td>
                      <td>{REFUND_REASON_LABEL[r.reason as keyof typeof REFUND_REASON_LABEL]}</td>
                      <td className="r"><Money v={r.paidToDate} /></td>
                      <td className="r"><Money v={r.status === "PAID" ? r.policyAmount : 0} zero="—" /></td>
                      <td><RefundTag status={r.status} /></td>
                      <td className="whitespace-nowrap">{d(r.refundedOn ?? r.approvedAt)}{r.refundMethod && <div className="text-[12px] text-muted">{PAYMENT_METHOD_LABEL[r.refundMethod as keyof typeof PAYMENT_METHOD_LABEL]}{r.refundRef ? ` · ${r.refundRef}` : ""}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Section>
      </div>
    </>
  );
}
