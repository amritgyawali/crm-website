import type { Prisma } from "@prisma/client";
import { subDays } from "date-fns";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ranges } from "@/lib/dates";
import { getDueInstallments } from "@/lib/dues";
import { computeLedger } from "@/lib/ledger";
import { getSettings, num } from "@/lib/settings";
import { CANDIDATE_STATUS, CLOSED_STATUSES, STAGES } from "@/lib/constants";
import { d, dt, fillTemplate, midSentence, money } from "@/lib/format";
import { Empty, Field, PageHeader, Section, Select, TableWrap, Textarea, btn } from "@/components/ui";
import { SendQueue, type QueueItem } from "./queue";

export const metadata = { title: "WhatsApp sending" };

const AUDIENCES = [
  { value: "overdue", label: "Fees overdue" },
  { value: "week", label: "Fees due this week" },
  { value: "callbacks", label: "Call-backs due today" },
  { value: "stale", label: "Leads not contacted" },
  { value: "newleads", label: "New leads never called" },
  { value: "status", label: "By status…" },
  { value: "stage", label: "By visa stage…" },
  { value: "job", label: "By job order…" },
];

type SP = { audience?: string; status?: string; stage?: string; job?: string; template?: string; text?: string };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePage("call.log");
  const sp = await searchParams;
  const s = await getSettings();
  const r = ranges();
  const mine = !can(user.role, "calls.viewAll") && !can(user.role, "finance.view");
  const [templates, jobs, recent] = await Promise.all([
    db.messageTemplate.findMany({ where: { audience: "CANDIDATE" }, orderBy: { name: "asc" } }),
    db.jobOrder.findMany({ where: { status: { in: ["OPEN", "ON_HOLD"] } }, orderBy: { reference: "asc" } }),
    db.messageLog.findMany({ where: mine ? { userId: user.id } : {}, orderBy: { createdAt: "desc" }, take: 12, include: { candidate: { select: { id: true, fullName: true } }, user: { select: { name: true } } } }),
  ]);

  const tpl = templates.find((t) => t.id === sp.template);
  const body = sp.template === "custom" ? sp.text ?? "" : tpl?.body ?? "";
  let items: QueueItem[] = [];
  let ready = false;

  if (sp.audience && body.trim()) {
    ready = true;
    const scope: Prisma.CandidateWhereInput = mine ? { assignedToId: user.id } : {};
    let where: Prisma.CandidateWhereInput | null = null;
    const ctx = new Map<string, { context: string; installment?: string; amount?: number; due?: Date }>();

    if (sp.audience === "overdue" || sp.audience === "week") {
      const dues = await getDueInstallments({ until: sp.audience === "overdue" ? subDays(r.todayStart, 0) : r.weekEnd, assignedToId: mine ? user.id : undefined });
      for (const x of dues.filter((x) => (sp.audience === "overdue" ? x.dueDate < r.todayStart : x.dueDate >= r.todayStart))) {
        if (!ctx.has(x.candidateId)) ctx.set(x.candidateId, { context: `${x.label}: ${money(x.outstanding)} due ${d(x.dueDate, "d MMM")}`, installment: x.label, amount: x.outstanding, due: x.dueDate });
      }
      where = { id: { in: [...ctx.keys()] } };
    } else if (sp.audience === "callbacks") where = { ...scope, nextCallAt: { lte: r.todayEnd }, status: { notIn: CLOSED_STATUSES } };
    else if (sp.audience === "stale") {
      const cutoff = subDays(r.now, num(s.leadNoContactDays, 2));
      where = { ...scope, status: { in: ["LEAD", "CONTACTED", "INTERESTED"] }, OR: [{ lastContactedAt: null, createdAt: { lt: cutoff } }, { lastContactedAt: { lt: cutoff } }] };
    } else if (sp.audience === "newleads") where = { ...scope, status: "LEAD", lastContactedAt: null };
    else if (sp.audience === "status" && sp.status) where = { ...scope, status: sp.status };
    else if (sp.audience === "stage" && sp.stage) where = { ...scope, stage: sp.stage, status: { in: ["IN_PROCESS", "DEPLOYED"] } };
    else if (sp.audience === "job" && sp.job) where = { ...scope, jobOrderId: sp.job, status: { notIn: CLOSED_STATUSES } };

    if (where) {
      const cands = await db.candidate.findMany({
        where, take: 300, orderBy: { fullName: "asc" },
        select: {
          id: true, fullName: true, phone: true, whatsapp: true, status: true, agreedAmount: true,
          jobOrder: { select: { position: true, country: true } }, installments: true, payments: { select: { amount: true } },
          messages: { where: { createdAt: { gte: r.todayStart } }, select: { template: true } },
        },
      });
      items = cands.map((c) => {
        const L = computeLedger(c);
        const x = ctx.get(c.id);
        const next = L.nextDue;
        const text = fillTemplate(body, {
          name: c.fullName.split(" ")[0], fullName: c.fullName, staff: user.name, company: s.companyName, address: s.companyAddress,
          job: c.jobOrder ? `${c.jobOrder.position} (${c.jobOrder.country})` : "the job",
          balance: money(L.balance), installment: midSentence(x?.installment ?? next?.label ?? "your installment"),
          amount: money(x?.amount ?? next?.outstanding ?? 0), dueDate: d(x?.due ?? next?.dueDate ?? null),
        });
        const name = tpl?.name ?? "Custom message";
        return {
          id: c.id, name: c.fullName, phone: c.whatsapp || c.phone, text,
          context: x?.context ?? (c.jobOrder ? `${c.jobOrder.position}, ${c.jobOrder.country}` : c.phone),
          sentToday: c.messages.some((m) => m.template === name),
        };
      });
    }
  }

  return (
    <>
      <PageHeader title="WhatsApp sending" meta="Pick who and what, then go down the list. Each message opens in WhatsApp ready to send, and is logged on the candidate." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5 min-w-0">
          <Section title="Who and what">
            <form className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Send to"><Select name="audience" defaultValue={sp.audience ?? ""} placeholder="Choose a list…" options={AUDIENCES} /></Field>
                <Field label="Status (for “by status”)"><Select name="status" defaultValue={sp.status ?? ""} placeholder="—" options={CANDIDATE_STATUS} /></Field>
                <Field label="Stage (for “by stage”)"><Select name="stage" defaultValue={sp.stage ?? ""} placeholder="—" options={STAGES.map((x) => ({ value: x.value, label: x.short }))} /></Field>
                <Field label="Job (for “by job order”)"><Select name="job" defaultValue={sp.job ?? ""} placeholder="—" options={jobs.map((j) => ({ value: j.id, label: `${j.reference} · ${j.position}` }))} /></Field>
              </div>
              <Field label="Message"><Select name="template" defaultValue={sp.template ?? ""} placeholder="Choose a template…" options={[...templates.map((t) => ({ value: t.id, label: t.name })), { value: "custom", label: "Write my own" }]} /></Field>
              {sp.template === "custom" && (
                <Field label="Your message" hint="You can use {name}, {balance}, {amount}, {dueDate}, {installment}, {job}, {staff}, {company}">
                  <Textarea name="text" rows={4} defaultValue={sp.text ?? ""} />
                </Field>
              )}
              <button className={btn("primary")}>Build list</button>
              {sp.template === "custom" && !sp.text && <span className="text-[12.5px] text-muted ml-3">Write the message, then build the list.</span>}
            </form>
          </Section>

          {ready && (
            <Section title="Sending list" note={`${items.length} people${items.length === 300 ? " (first 300)" : ""}`} flush>
              <SendQueue items={items} template={tpl?.name ?? "Custom message"} />
            </Section>
          )}
        </div>

        <Section title="Recently sent" flush>
          {recent.length === 0 ? <Empty>Nothing sent yet.</Empty> : (
            <TableWrap>
              <table className="grid-table">
                <tbody>
                  {recent.map((m) => (
                    <tr key={m.id}>
                      <td className="text-[13px]">
                        {m.candidate ? <a className="row-link" href={`/candidates/${m.candidate.id}`}>{m.candidate.fullName}</a> : "—"}
                        <div className="text-[12px] text-muted">{m.template ?? "Message"} · {m.user.name}</div>
                      </td>
                      <td className="text-[12px] text-muted num whitespace-nowrap text-right">{dt(m.createdAt)}</td>
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
