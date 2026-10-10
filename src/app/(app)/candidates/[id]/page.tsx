import Link from "next/link";
import { notFound } from "next/navigation";
import { addMonths, differenceInCalendarDays } from "date-fns";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { computeLedger } from "@/lib/ledger";
import { getSettings, getStageDays, num } from "@/lib/settings";
import { d, dt, fillTemplate, money, relDays } from "@/lib/format";
import { toDateInput } from "@/lib/dates";
import {
  CLOSED_STATUSES, DOCUMENT_KINDS, DOCUMENT_KIND_LABEL, LEAD_SOURCE_LABEL, PAYMENT_METHODS, PAYMENT_METHOD_LABEL,
  REFUND_REASON_LABEL, STAGES, STAGE_LABEL, STAGE_ORDER, stageIndex, type CandidateStatus, type Stage,
} from "@/lib/constants";
import {
  Disclose, Empty, Field, Figure, Figures, FormGrid, Input, KV, LinkButton, Money, Notice, PageHeader, Section, Select,
  TableWrap, Tag, Textarea, cx,
} from "@/components/ui";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { ContactButtons, RemindButton } from "@/components/contact";
import { reminderWriter } from "@/lib/reminder";
import { OutcomeTag, RefundTag, StageTag, StatusTag } from "@/components/tags";
import { TemplatePicker } from "@/components/template-picker";
import { CallLogger } from "./call-logger";
import { StageForm } from "./stage-form";
import {
  assignCandidate, closeCase, deleteCallLog, deleteDocument, deleteInstallment, deletePayment, deleteStageEvent, logCall,
  recordPayment, saveInstallment, setupLedger, updatePayment, updateStage, uploadDocument,
} from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.candidate.findUnique({ where: { id }, select: { fullName: true } });
  return { title: c?.fullName ?? "Candidate" };
}

const STATE_LABEL = { PAID: "Paid", PART: "Part paid", DUE: "Due", OVERDUE: "Overdue", WAITING: "Waiting for stage" } as const;
const STATE_TONE = { PAID: "green", PART: "amber", DUE: "plain", OVERDUE: "red", WAITING: "faint" } as const;

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const c = await db.candidate.findUnique({
    where: { id },
    include: {
      jobOrder: { include: { partner: { select: { id: true, name: true } } } },
      assignedTo: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true } },
      sourcePartner: { select: { id: true, name: true } },
      feePackage: { select: { id: true, name: true, refundPolicy: true } },
      installments: { orderBy: { sequence: "asc" } },
      payments: { orderBy: { date: "asc" }, include: { receivedBy: { select: { name: true } } } },
      refunds: { orderBy: { createdAt: "desc" }, include: { approvedBy: { select: { name: true } }, requestedBy: { select: { name: true } } } },
      callLogs: { orderBy: { createdAt: "desc" }, take: 25, include: { user: { select: { name: true } } } },
      stageEvents: { orderBy: [{ date: "asc" }, { createdAt: "asc" }], include: { user: { select: { name: true } } } },
      documents: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
    },
  });
  if (!c) notFound();

  const [s, stageDays, packages, staff, templates, activity, callCount] = await Promise.all([
    getSettings(),
    getStageDays(),
    db.feePackage.findMany({ where: { active: true }, orderBy: { name: "asc" }, include: { jobOrder: { select: { reference: true } } } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.messageTemplate.findMany({ where: { audience: "CANDIDATE" }, orderBy: { name: "asc" } }),
    db.auditLog.findMany({
      where: { entityId: { in: [id, ...c.payments.map((p) => p.id), ...c.installments.map((i) => i.id)] } },
      orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true } } },
    }),
    db.callLog.count({ where: { candidateId: id } }),
  ]);

  const now = new Date();
  const L = computeLedger(c, now);
  const closed = CLOSED_STATUSES.includes(c.status as CandidateStatus);
  const r = user.role;
  const daysInStage = c.stageEnteredAt ? differenceInCalendarDays(now, c.stageEnteredAt) : 0;
  const stageLimit = c.stage ? stageDays[c.stage as Stage] : 0;
  const stuck = !!c.stage && c.stage !== "ARRIVED" && c.stage !== "POST_ARRIVAL" && daysInStage > stageLimit && !closed;
  const passportLimit = addMonths(now, num(s.passportAlertMonths, 12));
  const contractEnd = addMonths(now, c.jobOrder?.contractMonths ?? 0);
  const passportWarn = !!c.passportExpiry && !closed && (c.passportExpiry < passportLimit || c.passportExpiry < contractEnd);
  const paidSoFar = L.paid;
  const lastDone = [...c.stageEvents].reverse().find((e) => e.result === "DONE");
  const suggested = (STAGE_ORDER[Math.min(stageIndex(lastDone?.stage) + 1, STAGE_ORDER.length - 1)] ?? "SELECTED") as Stage;
  const contact = c.whatsapp || c.phone;
  const lastEventId = c.stageEvents[c.stageEvents.length - 1]?.id;

  const vars = {
    name: c.fullName.split(" ")[0], fullName: c.fullName, staff: user.name, company: s.companyName, address: s.companyAddress,
    job: c.jobOrder ? `${c.jobOrder.position} (${c.jobOrder.country})` : "the job",
    balance: money(L.balance), amount: L.nextDue ? money(L.nextDue.outstanding) : "", installment: L.nextDue?.label ?? "your installment",
    dueDate: L.nextDue?.dueDate ? d(L.nextDue.dueDate) : "",
  };
  const write = await reminderWriter(user.name);
  const callBox = (
    <Section title="Log a call" note={c.nextCallAt ? `Next call ${relDays(c.nextCallAt)}` : undefined}>
      <div className="mb-3"><ContactButtons phone={c.phone} whatsapp={c.whatsapp} /></div>
      <CallLogger action={logCall.bind(null, c.id)} />
    </Section>
  );
  const tpl = templates.map((t) => ({ name: t.name, text: fillTemplate(t.body, vars) }));

  return (
    <>
      <PageHeader
        back={{ href: "/candidates", label: "Candidates" }}
        title={c.fullName}
        meta={
          <>
            <span className="num">{c.code}</span>
            <StatusTag status={c.status} />
            {c.stage && !closed && <StageTag stage={c.stage} />}
            <span>{c.nationality}</span>
            <span>Staff: {c.assignedTo?.name ?? <span className="text-warn">not assigned</span>}</span>
          </>
        }
        actions={
          <>
            <ContactButtons phone={c.phone} whatsapp={c.whatsapp} size="md" />
            <TemplatePicker phone={contact} templates={tpl} />
            {can(r, "candidate.edit") && <LinkButton href={`/candidates/${c.id}/edit`}>Edit</LinkButton>}
          </>
        }
      />

      <div className="space-y-2 mb-5">
        {closed && (
          <Notice tone="red">
            Case closed {c.closedAt ? relDays(c.closedAt) : ""}{c.closedReason ? `: ${c.closedReason}` : ""}.
            {c.refunds[0] && <> Refund record: {money(c.refunds[0].policyAmount)}, {c.refunds[0].status.toLowerCase().replace("_", " ")}.</>}
          </Notice>
        )}
        {L.overdue > 0 && <Notice tone="red">{money(L.overdue)} overdue. Last payment {c.payments.length ? relDays(c.payments[c.payments.length - 1]!.date) : "never"}.</Notice>}
        {stuck && <Notice>In “{STAGE_LABEL[c.stage as Stage]}” for {daysInStage} days. The limit for this stage is {stageLimit} days.</Notice>}
        {passportWarn && (
          <Notice tone={c.passportExpiry! < addMonths(now, 6) ? "red" : "amber"}>
            Passport expires {d(c.passportExpiry)}
            {c.passportExpiry! < passportLimit ? `, within ${s.passportAlertMonths} months` : ", before the job contract would end"}. Ask for renewal before visa filing.
          </Notice>
        )}
        {!c.assignedToId && can(r, "candidate.assign") && (
          <Notice tone="blue">
            <ActionForm action={assignCandidate.bind(null, c.id)} className="flex flex-wrap items-center gap-2" showMessage={false}>
              <span>Nobody is following this candidate.</span>
              <select name="assignedToId" className="control !w-auto !min-h-[28px] !py-0.5" required defaultValue="">
                <option value="" disabled>Choose staff…</option>
                {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <Submit size="sm">Assign</Submit>
            </ActionForm>
          </Notice>
        )}
      </div>

      <Figures cols={6}>
        <Figure label="Agreed fee" value={money(c.agreedAmount, { cur: false })} sub={c.feePackage?.name ?? "No fee plan yet"} />
        <Figure label="Paid" value={money(L.paid, { cur: false })} sub={`${c.payments.length} payment${c.payments.length === 1 ? "" : "s"}`} tone="green" />
        <Figure label="Balance" value={closed ? "—" : money(L.balance, { cur: false })} sub={L.overdue ? `${money(L.overdue)} overdue` : closed ? "Case closed" : "AED"} tone={L.overdue ? "red" : undefined} />
        <Figure label="Next due" value={L.nextDue?.dueDate ? d(L.nextDue.dueDate, "d MMM") : "—"} sub={L.nextDue ? `${money(L.nextDue.outstanding)} · ${relDays(L.nextDue.dueDate)}` : "Nothing scheduled"} tone={L.nextDue?.state === "OVERDUE" ? "red" : undefined} />
        <Figure label="Stage" value={c.stage ? `${stageIndex(c.stage) + 1}/9` : "—"} sub={c.stage ? `${STAGE_LABEL[c.stage as Stage]} · ${daysInStage}d` : "Not started"} tone={stuck ? "amber" : undefined} />
        <Figure label="Passport expiry" value={c.passportExpiry ? d(c.passportExpiry, "MMM yyyy") : "—"} sub={c.passportNo ?? "No number"} tone={passportWarn ? "red" : undefined} />
      </Figures>

      {/* on phones the call box comes first: sales staff log calls from their mobiles */}
      {can(r, "call.log") && <div className="xl:hidden mt-5">{callBox}</div>}

      <div className="grid gap-5 mt-5 xl:grid-cols-[minmax(0,1fr)_370px]">
        {/* ------------------------------------------------ left column */}
        <div className="space-y-5 min-w-0">
          {/* ledger */}
          <Section
            title="Fee ledger"
            note={c.feePackage ? c.feePackage.name : undefined}
            flush
            actions={can(r, "reports.view") && c.payments.length > 0 && <Link className="link text-[12.5px]" href={`/print/statement/${c.id}`} target="_blank">Print statement</Link>}
          >
            {c.installments.length === 0 ? (
              <Empty>No installment plan yet. {can(r, "ledger.setup") ? "Choose a fee package below to build one." : "Ask finance to set up the fee plan."}</Empty>
            ) : (
              <TableWrap>
                <table className="grid-table">
                  <thead>
                    <tr><th>#</th><th>Installment</th><th>Due</th><th className="r">Amount</th><th className="r">Paid</th><th className="r">Outstanding</th><th></th>{can(r, "ledger.setup") && <th></th>}</tr>
                  </thead>
                  <tbody>
                    {L.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="num text-muted">{row.sequence}</td>
                        <td>{row.label}{row.stage && <div className="text-[12px] text-muted">Linked to: {STAGE_LABEL[row.stage as Stage]}</div>}</td>
                        <td className="whitespace-nowrap">{row.dueDate ? <>{d(row.dueDate)}{row.state !== "PAID" && <div className={cx("text-[12px]", row.state === "OVERDUE" ? "text-danger" : "text-muted")}>{relDays(row.dueDate)}</div>}</> : <span className="text-muted">On stage</span>}</td>
                        <td className="r"><Money v={row.amount} /></td>
                        <td className="r"><Money v={row.paid} zero="—" /></td>
                        <td className="r font-medium"><Money v={row.outstanding} zero="—" /></td>
                        <td className="whitespace-nowrap">
                          <Tag tone={STATE_TONE[row.state]}>{STATE_LABEL[row.state]}</Tag>
                          {!closed && row.dueDate && row.outstanding > 0 && can(r, "call.log") && (
                            <div className="mt-1"><RemindButton phone={contact} text={write({ name: c.fullName, label: row.label, outstanding: row.outstanding, dueDate: row.dueDate, balance: L.balance })} /></div>
                          )}
                        </td>
                        {can(r, "ledger.setup") && (
                          <td className="whitespace-nowrap">
                            <details className="inline-block relative">
                              <summary className="list-none cursor-pointer text-[12.5px] link [&::-webkit-details-marker]:hidden">Change</summary>
                              <div className="absolute right-0 z-10 mt-1 w-[320px] bg-sheet border border-rule-2 p-3 shadow-[0_6px_18px_rgba(0,0,0,.08)]">
                                <ActionForm action={saveInstallment.bind(null, c.id, row.id)} reset={false} className="space-y-2">
                                  <Field label="Description"><Input name="label" defaultValue={row.label} /></Field>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Field label="Amount"><Input name="amount" defaultValue={String(row.amount)} className="num" /></Field>
                                    <Field label="Due date"><Input name="dueDate" type="date" defaultValue={toDateInput(row.dueDate)} /></Field>
                                  </div>
                                  <Field label="Or due at stage"><Select name="stage" defaultValue={row.stage ?? ""} placeholder="—" options={STAGES} /></Field>
                                  <div className="flex justify-between">
                                    <Submit size="sm">Save</Submit>
                                    <ActionButton action={deleteInstallment.bind(null, row.id)} variant="danger" confirm="Remove this installment?">Remove</ActionButton>
                                  </div>
                                </ActionForm>
                              </div>
                            </details>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td></td><td>Total</td><td></td>
                      <td className="r"><Money v={L.planned} /></td>
                      <td className="r"><Money v={Math.min(L.paid, L.planned)} /></td>
                      <td className="r"><Money v={closed ? 0 : Math.max(L.planned - L.paid, 0)} zero="—" /></td>
                      <td colSpan={can(r, "ledger.setup") ? 2 : 1}></td>
                    </tr>
                  </tfoot>
                </table>
              </TableWrap>
            )}
            {Math.abs(L.planned - c.agreedAmount) > 0.01 && c.installments.length > 0 && (
              <div className="px-4 py-2 text-[12.5px] text-warn border-t border-rule">Installments add up to {money(L.planned)} but the agreed fee is {money(c.agreedAmount)}.</div>
            )}

            {/* payments */}
            <div className="border-t border-rule">
              <div className="px-4 pt-3 pb-1 flex items-baseline justify-between">
                <h3 className="text-[13px] font-semibold">Payments received</h3>
                <span className="text-[12px] text-muted">Only finance and management can change a saved payment. Every change is logged.</span>
              </div>
              {c.payments.length === 0 ? (
                <Empty>No payments yet.</Empty>
              ) : (
                <TableWrap>
                  <table className="grid-table">
                    <thead><tr><th>Date</th><th>Receipt</th><th>Method</th><th>Received by</th><th className="r">Amount</th><th></th></tr></thead>
                    <tbody>
                      {c.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="whitespace-nowrap">{d(p.date)}</td>
                          <td className="num">{p.receiptNo}</td>
                          <td>{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL]}{p.reference && <div className="text-[12px] text-muted num">{p.reference}</div>}</td>
                          <td>{p.receivedBy.name}</td>
                          <td className="r font-medium"><Money v={p.amount} /></td>
                          <td className="whitespace-nowrap text-right">
                            <span className="inline-flex gap-3 items-center text-[12.5px]">
                              <Link className="link" href={`/print/receipt/${p.id}`} target="_blank">Receipt</Link>
                              {can(r, "payment.edit") && (
                                <details className="inline-block relative text-left">
                                  <summary className="list-none cursor-pointer link [&::-webkit-details-marker]:hidden">Edit</summary>
                                  <div className="absolute right-0 z-10 mt-1 w-[340px] bg-sheet border border-rule-2 p-3 shadow-[0_6px_18px_rgba(0,0,0,.08)]">
                                    <ActionForm action={updatePayment.bind(null, p.id)} reset={false} className="space-y-2">
                                      <div className="grid grid-cols-2 gap-2">
                                        <Field label="Amount"><Input name="amount" defaultValue={String(p.amount)} className="num" /></Field>
                                        <Field label="Date"><Input name="date" type="date" defaultValue={toDateInput(p.date)} /></Field>
                                        <Field label="Method"><Select name="method" defaultValue={p.method} options={PAYMENT_METHODS} /></Field>
                                        <Field label="Received by"><Select name="receivedById" defaultValue={p.receivedById} options={staff.map((u) => ({ value: u.id, label: u.name }))} /></Field>
                                      </div>
                                      <Field label="Reference"><Input name="reference" defaultValue={p.reference ?? ""} /></Field>
                                      <Field label="Note"><Input name="note" defaultValue={p.note ?? ""} /></Field>
                                      <Field label="Reason for change" required><Input name="reason" required /></Field>
                                      <div className="flex justify-between">
                                        <Submit size="sm">Save change</Submit>
                                        <ActionButton action={deletePayment.bind(null, p.id)} variant="danger" prompt={`Delete payment ${p.receiptNo}? Type the reason:`}>Delete</ActionButton>
                                      </div>
                                    </ActionForm>
                                  </div>
                                </details>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </div>

            <div className="p-4 border-t border-rule grid gap-3">
              {!closed && can(r, "payment.record") && (
                <Disclose label="Record a payment" open={L.overdue > 0 || L.nextDue?.state === "DUE"}>
                  <ActionForm action={recordPayment.bind(null, c.id)} className="space-y-3 pt-2">
                    <FormGrid cols={4}>
                      <Field label="Amount (AED)" required><Input name="amount" inputMode="decimal" className="num" required defaultValue={L.nextDue ? String(L.nextDue.outstanding) : ""} /></Field>
                      <Field label="Date" required><Input name="date" type="date" defaultValue={toDateInput(now)} required /></Field>
                      <Field label="Method" required><Select name="method" defaultValue="CASH" options={PAYMENT_METHODS} /></Field>
                      <Field label="Bank / card reference"><Input name="reference" placeholder="Required for transfers" /></Field>
                    </FormGrid>
                    <FormGrid cols={2}>
                      {can(r, "payment.edit") ? (
                        <Field label="Received by"><Select name="receivedById" defaultValue={user.id} options={staff.map((u) => ({ value: u.id, label: u.name }))} /></Field>
                      ) : (
                        <Field label="Received by"><Input value={user.name} disabled readOnly /></Field>
                      )}
                      <Field label="Note"><Input name="note" /></Field>
                    </FormGrid>
                    <div className="flex items-center gap-4">
                      <Submit>Save payment & create receipt</Submit>
                      <label className="flex items-center gap-2 text-[12.5px] text-muted"><input type="checkbox" name="allowOver" value="1" /> allow overpayment</label>
                    </div>
                  </ActionForm>
                </Disclose>
              )}
              {can(r, "ledger.setup") && !closed && (
                <Disclose label={c.installments.length ? "Change fee package" : "Set up fee plan from a package"} open={!c.installments.length && ["ENROLLED", "INTERESTED"].includes(c.status)}>
                  <ActionForm action={setupLedger.bind(null, c.id)} className="space-y-3 pt-2">
                    <FormGrid cols={3}>
                      <Field label="Fee package" required className="sm:col-span-2">
                        <Select name="packageId" required defaultValue={c.feePackageId ?? packages.find((p) => p.jobOrderId === c.jobOrderId)?.id ?? ""} placeholder="Choose…"
                          options={packages.map((p) => ({ value: p.id, label: `${p.name} · ${money(p.totalAmount)}${p.jobOrder ? ` · ${p.jobOrder.reference}` : ""}` }))} />
                      </Field>
                      <Field label="Discount (AED)" hint="Approved by management"><Input name="discount" inputMode="decimal" className="num" defaultValue="0" /></Field>
                      {!c.enrolledOn && <Field label="Enrolment date"><Input name="enrolledOn" type="date" defaultValue={toDateInput(now)} /></Field>}
                    </FormGrid>
                    <p className="text-[12.5px] text-muted">Packages are checked against the fee limits for the destination country and the candidate&apos;s nationality.</p>
                    <div className="flex items-center gap-4">
                      <Submit>Build installment plan</Submit>
                      {c.installments.length > 0 && <label className="flex items-center gap-2 text-[12.5px] text-muted"><input type="checkbox" name="replace" value="1" /> replace current plan</label>}
                    </div>
                  </ActionForm>
                </Disclose>
              )}
              {can(r, "ledger.setup") && !closed && c.installments.length > 0 && (
                <Disclose label="Add an installment">
                  <ActionForm action={saveInstallment.bind(null, c.id, null)} className="space-y-3 pt-2">
                    <FormGrid cols={4}>
                      <Field label="Description" required><Input name="label" required placeholder="Extra documentation fee" /></Field>
                      <Field label="Amount" required><Input name="amount" className="num" required /></Field>
                      <Field label="Due date"><Input name="dueDate" type="date" /></Field>
                      <Field label="Or due at stage"><Select name="stage" placeholder="—" options={STAGES} /></Field>
                    </FormGrid>
                    <Submit size="sm">Add</Submit>
                  </ActionForm>
                </Disclose>
              )}
            </div>

            {/* refunds */}
            {(c.refunds.length > 0 || (!closed && can(r, "refund.request"))) && (
              <div className="border-t border-rule">
                <div className="px-4 pt-3 pb-1"><h3 className="text-[13px] font-semibold">Refund & withdrawal</h3></div>
                {c.refunds.length === 0 ? (
                  <p className="px-4 pb-3 text-[13px] text-muted">No refund on record. If the candidate withdraws, close the case below; a refund record is opened for approval.</p>
                ) : (
                  <TableWrap>
                    <table className="grid-table">
                      <thead><tr><th>Opened</th><th>Reason</th><th className="r">Paid</th><th className="r">Refund per policy</th><th>Approval</th><th>Refunded</th></tr></thead>
                      <tbody>
                        {c.refunds.map((f) => (
                          <tr key={f.id}>
                            <td className="whitespace-nowrap">{d(f.createdAt)}<div className="text-[12px] text-muted">{f.requestedBy.name}</div></td>
                            <td>{REFUND_REASON_LABEL[f.reason as keyof typeof REFUND_REASON_LABEL] ?? f.reason}{f.stageAtClose && <div className="text-[12px] text-muted">at {STAGE_LABEL[f.stageAtClose as Stage]}</div>}{f.note && <div className="text-[12px] text-muted max-w-[260px]">{f.note}</div>}</td>
                            <td className="r"><Money v={f.paidToDate} /></td>
                            <td className="r font-medium"><Money v={f.policyAmount} /></td>
                            <td><RefundTag status={f.status} />{f.approvedBy && <div className="text-[12px] text-muted mt-0.5">{f.approvedBy.name}, {d(f.approvedAt)}</div>}</td>
                            <td className="whitespace-nowrap">{f.refundedOn ? <>{d(f.refundedOn)}<div className="text-[12px] text-muted">{f.refundMethod ? PAYMENT_METHOD_LABEL[f.refundMethod as keyof typeof PAYMENT_METHOD_LABEL] : ""}</div></> : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {can(r, "refund.approve") || can(r, "refund.pay") ? <p className="px-4 py-2 text-[12.5px]"><Link className="link" href="/finance/refunds">Approve or mark refunds paid</Link></p> : null}
                  </TableWrap>
                )}
                {!closed && can(r, "refund.request") && (
                  <div className="p-4 pt-1">
                    <Disclose label="Close case (withdrawal or not eligible)">
                      <ActionForm action={closeCase.bind(null, c.id)} className="space-y-3 pt-2">
                        {c.feePackage?.refundPolicy && <p className="text-[12.5px] text-muted">Policy: {c.feePackage.refundPolicy}</p>}
                        <FormGrid cols={3}>
                          <Field label="Reason" required><Select name="reason" required options={[{ value: "WITHDRAWN", label: "Candidate withdrew" }, { value: "NOT_ELIGIBLE", label: "Not eligible" }, { value: "OTHER", label: "Other" }]} /></Field>
                          <Field label="Refund as per policy" hint={`Paid so far ${money(paidSoFar)}`}><Input name="refundAmount" className="num" defaultValue="0" /></Field>
                        </FormGrid>
                        <Field label="Note" required><Textarea name="note" required rows={2} placeholder="What the candidate said, who decided" /></Field>
                        <Submit variant="danger">Close case</Submit>
                      </ActionForm>
                    </Disclose>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* visa & deployment */}
          <Section title="Visa & deployment" note={c.jobOrder ? `${c.jobOrder.employer}, ${c.jobOrder.country}` : "No job order linked"} flush>
            <ol className="px-4 py-3">
              {STAGES.map((st, i) => {
                const evs = c.stageEvents.filter((e) => e.stage === st.value);
                const ev = evs[evs.length - 1];
                const reached = !!ev;
                const current = c.stage === st.value && !closed;
                const refused = ev?.result === "REFUSED";
                return (
                  <li key={st.value} className="grid grid-cols-[28px_1fr] gap-x-3">
                    <div className="flex flex-col items-center">
                      <span className={cx(
                        "num text-[11px] w-[22px] h-[22px] flex items-center justify-center rounded-full border",
                        refused ? "bg-danger text-white border-danger" : reached ? "bg-ink text-paper border-ink" : "border-rule-2 text-muted bg-white",
                        current && "ring-2 ring-mark ring-offset-1",
                      )}>{refused ? "×" : i + 1}</span>
                      {i < STAGES.length - 1 && <span className={cx("w-px flex-1 min-h-[14px]", reached ? "bg-ink" : "bg-rule-2")} />}
                    </div>
                    <div className="pb-3 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className={cx("text-[13.5px]", reached ? "font-medium" : "text-muted")}>{refused ? st.label.replace("approved", "refused") : st.label}</span>
                        {ev && <span className="text-[12.5px] text-muted">{d(ev.date)} · {ev.user.name}</span>}
                        {current && c.stageEnteredAt && <Tag tone={stuck ? "amber" : "plain"}>{daysInStage} days here</Tag>}
                      </div>
                      {ev && (ev.note || ev.location || ev.flightDetails || ev.refusalReason || ev.appointmentAt) && (
                        <div className="text-[12.5px] text-ink-2 mt-0.5 space-y-0.5">
                          {ev.appointmentAt && <div>Appointment {dt(ev.appointmentAt)}{ev.location ? `, ${ev.location}` : ""}</div>}
                          {ev.flightDetails && <div>{ev.flightDetails}</div>}
                          {ev.refusalReason && <div className="text-danger">Reason: {ev.refusalReason}</div>}
                          {ev.note && <div className="text-muted">{ev.note}</div>}
                        </div>
                      )}
                      {ev && ev.id === lastEventId && can(r, "stage.update") && (
                        <ActionButton action={deleteStageEvent.bind(null, ev.id)} variant="ghost" className="!h-5 !px-0 text-[11.5px] text-muted mt-0.5" confirm="Remove this stage entry?">undo</ActionButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {!closed && can(r, "stage.update") && ["ENROLLED", "IN_PROCESS", "DEPLOYED"].includes(c.status) && (
              <div className="p-4 border-t border-rule">
                <Disclose label="Update stage" open={c.status === "IN_PROCESS"}>
                  <div className="pt-2"><StageForm action={updateStage.bind(null, c.id)} suggested={suggested} paid={paidSoFar} /></div>
                </Disclose>
              </div>
            )}
            {!closed && !["ENROLLED", "IN_PROCESS", "DEPLOYED"].includes(c.status) && (
              <p className="px-4 pb-4 text-[12.5px] text-muted">The visa process starts after the candidate is enrolled.</p>
            )}
          </Section>

          {/* documents */}
          <Section title="Documents" note={`${c.documents.length} on file`} flush>
            {c.documents.length === 0 ? (
              <Empty>No documents uploaded.</Empty>
            ) : (
              <TableWrap>
                <table className="grid-table">
                  <thead><tr><th>Document</th><th>Type</th><th>Expires</th><th>Uploaded</th><th></th></tr></thead>
                  <tbody>
                    {c.documents.map((doc) => (
                      <tr key={doc.id}>
                        <td><a className="link" href={doc.fileUrl} target="_blank" rel="noreferrer">{doc.title}</a></td>
                        <td>{DOCUMENT_KIND_LABEL[doc.kind as keyof typeof DOCUMENT_KIND_LABEL] ?? doc.kind}</td>
                        <td className={cx("whitespace-nowrap", doc.expiresOn && doc.expiresOn < addMonths(now, 3) && "text-danger")}>{doc.expiresOn ? d(doc.expiresOn) : "—"}</td>
                        <td className="whitespace-nowrap text-[13px]">{d(doc.createdAt)}<div className="text-[12px] text-muted">{doc.uploadedBy.name}</div></td>
                        <td className="text-right">{can(r, "document.upload") && <ActionButton action={deleteDocument.bind(null, doc.id)} variant="ghost" confirm="Remove this document?">Remove</ActionButton>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
            {can(r, "document.upload") && (
              <div className="p-4 border-t border-rule">
                <ActionForm action={uploadDocument.bind(null, c.id)} className="grid gap-3 sm:grid-cols-[150px_1fr_150px_auto] items-end">
                  <Field label="Type"><Select name="kind" options={DOCUMENT_KINDS} /></Field>
                  <Field label="File (PDF or photo, 10 MB max)"><Input name="file" type="file" accept=".pdf,image/*" required /></Field>
                  <Field label="Expiry date"><Input name="expiresOn" type="date" /></Field>
                  <Submit>Upload</Submit>
                </ActionForm>
              </div>
            )}
          </Section>
        </div>

        {/* ------------------------------------------------ right column */}
        <div className="space-y-5 min-w-0">
          {can(r, "call.log") && <div className="hidden xl:block">{callBox}</div>}

          <Section title="Calls" note={`${callCount} total`} flush>
            {c.callLogs.length === 0 ? (
              <Empty>No calls yet.</Empty>
            ) : (
              <ul className="divide-y divide-rule max-h-[440px] overflow-y-auto">
                {c.callLogs.map((l) => (
                  <li key={l.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <OutcomeTag outcome={l.outcome} />
                      <span className="text-[12px] text-muted num">{dt(l.createdAt)}</span>
                    </div>
                    <div className="text-[12.5px] mt-1 text-ink-2">
                      {l.user.name}{l.channel === "WHATSAPP" ? " · WhatsApp" : ""}
                      {l.nextCallAt && <span className="text-muted"> · next {d(l.nextCallAt, "d MMM")}</span>}
                      {l.promisedDate && <span className="text-muted"> · promised {l.promisedAmount ? money(l.promisedAmount) + " " : ""}by {d(l.promisedDate, "d MMM")}</span>}
                    </div>
                    {l.note && <div className="text-[13px] mt-0.5">{l.note}</div>}
                    {l.userId === user.id && now.getTime() - l.createdAt.getTime() < 15 * 60 * 1000 && (
                      <ActionButton action={deleteCallLog.bind(null, l.id)} variant="ghost" className="!h-5 !px-0 text-[11.5px] text-muted" confirm="Remove this call?">undo</ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Details">
            <KV
              items={[
                ["Phone", <span className="num" key="p">{c.phone}</span>],
                ["WhatsApp", c.whatsapp ? <span className="num">{c.whatsapp}</span> : "Same as phone"],
                ["Email", c.email],
                ["Date of birth", c.dateOfBirth ? `${d(c.dateOfBirth)} (${Math.floor(differenceInCalendarDays(now, c.dateOfBirth) / 365.25)})` : null],
                ["Location", c.currentLocation],
                ["Trade", c.trade ? `${c.trade}${c.experienceYears != null ? `, ${c.experienceYears} yrs` : ""}` : null],
                ["Passport", c.passportNo ? <span className="num">{c.passportNo}</span> : null],
                ["Job order", c.jobOrder ? <Link className="link" href={`/jobs/${c.jobOrder.id}`}>{c.jobOrder.reference}</Link> : null],
                ["Partner", c.jobOrder?.partner ? <Link className="link" href={`/partners/${c.jobOrder.partner.id}`}>{c.jobOrder.partner.name}</Link> : null],
                ["Lead source", <span key="s">{LEAD_SOURCE_LABEL[c.leadSource as keyof typeof LEAD_SOURCE_LABEL]}{c.campaign && <>: <Link className="link" href={`/campaigns/${c.campaign.id}`}>{c.campaign.name}</Link></>}{c.sourcePartner && <>: <Link className="link" href={`/partners/${c.sourcePartner.id}`}>{c.sourcePartner.name}</Link></>}{c.referredBy && <>: {c.referredBy}</>}</span>],
                ["Added", d(c.createdAt)],
                ["Enrolled", c.enrolledOn ? d(c.enrolledOn) : null],
              ]}
            />
            {c.notes && <p className="text-[13px] mt-3 pt-3 border-t border-rule whitespace-pre-line">{c.notes}</p>}
          </Section>

          {activity.length > 0 && (
            <Section title="Activity" flush>
              <ul className="divide-y divide-rule">
                {activity.map((a) => (
                  <li key={a.id} className="px-4 py-2 text-[12.5px]">
                    <div>{a.summary}</div>
                    <div className="text-muted">{a.user?.name ?? "System"} · {dt(a.createdAt)}</div>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
