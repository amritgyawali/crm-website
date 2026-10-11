import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { TrackRecent } from "@/components/recent";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { partnerMoney } from "@/lib/partners";
import { toDateInput } from "@/lib/dates";
import { d, dt, fillTemplate, money, relDays } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { PARTNER_TYPE_LABEL, PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { Disclose, Empty, Field, Figure, Figures, FormGrid, Input, KV, LinkButton, Money, Notice, PageHeader, Section, Select, TableWrap, Tag, Textarea, btn, cx } from "@/components/ui";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { ContactButtons } from "@/components/contact";
import { TemplatePicker } from "@/components/template-picker";
import { JobStatusTag, StageTag, StatusTag } from "@/components/tags";
import { addAgreement, addContact, addPartnerEntry, addPartnerNote, deleteAgreement, deleteContact, deletePartnerEntry } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = await db.partner.findUnique({ where: { id: (await params).id }, select: { name: true } });
  return { title: p?.name ?? "Partner" };
}

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const p = await db.partner.findUnique({
    where: { id },
    include: {
      contacts: true,
      agreements: { orderBy: { expiresOn: "asc" } },
      partnerNotes: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      entries: { orderBy: { date: "desc" }, include: { jobOrder: { select: { reference: true } } } },
      jobOrders: { orderBy: { receivedOn: "desc" }, include: { candidates: { select: { status: true } } } },
    },
  });
  if (!p) notFound();
  const [cands, templates, s] = await Promise.all([
    db.candidate.findMany({
      where: { OR: [{ sourcePartnerId: id }, { jobOrder: { partnerId: id } }] },
      orderBy: { updatedAt: "desc" },
      select: { id: true, fullName: true, status: true, stage: true, sourcePartnerId: true, jobOrder: { select: { reference: true, partnerId: true } } },
    }),
    db.messageTemplate.findMany({ where: { audience: "PARTNER" } }),
    getSettings(),
  ]);
  const r = user.role;
  const fin = can(r, "partners.finance");
  const m = partnerMoney(p.entries);
  const now = new Date();
  const supplied = cands.filter((c) => c.sourcePartnerId === id);
  const onTheirJobs = cands.filter((c) => c.jobOrder?.partnerId === id);
  const selected = cands.filter((c) => ["IN_PROCESS", "DEPLOYED"].includes(c.status)).length;
  const deployed = cands.filter((c) => c.status === "DEPLOYED").length;
  const contact = p.contacts[0];
  const phone = p.whatsapp || p.phone || contact?.whatsapp || contact?.phone || "";
  const tpl = templates.map((t) => ({ name: t.name, text: fillTemplate(t.body, { contact: contact?.name ?? p.name, company: s.companyName, staff: user.name, balance: money(m.theyOweOut) }) }));
  const expiring = p.agreements.filter((a) => a.expiresOn && a.expiresOn < addDays(now, a.remindDays));

  return (
    <>
      <TrackRecent item={{ group: "Partners", title: p.name, detail: p.country, href: `/partners/${p.id}` }} />
      <PageHeader
        back={{ href: "/partners", label: "Partners" }}
        title={p.name}
        meta={<><span>{p.country}</span><Tag tone="plain">{PARTNER_TYPE_LABEL[p.type as keyof typeof PARTNER_TYPE_LABEL]}</Tag>{p.status !== "ACTIVE" && <Tag tone="faint">{p.status.toLowerCase().replace("_", " ")}</Tag>}{p.nextFollowUp && <span className={cx(p.nextFollowUp < now && "text-danger")}>Follow up {relDays(p.nextFollowUp)}</span>}</>}
        actions={
          <>
            {phone && <ContactButtons phone={p.phone || phone} whatsapp={phone} size="md" />}
            {phone && <TemplatePicker phone={phone} templates={tpl} />}
            {p.email && <a className={btn("secondary")} href={`mailto:${p.email}`}>Email</a>}
            {can(r, "partners.manage") && <LinkButton href={`/partners/${p.id}/edit`}>Edit</LinkButton>}
          </>
        }
      />
      {expiring.length > 0 && (
        <div className="mb-5 space-y-2">
          {expiring.map((a) => <Notice key={a.id} tone={a.expiresOn! < now ? "red" : "amber"}>“{a.title}” {a.expiresOn! < now ? "expired" : "expires"} {relDays(a.expiresOn)} ({d(a.expiresOn)}). Start the renewal.</Notice>)}
        </div>
      )}

      <Figures cols={fin ? 6 : 4}>
        <Figure label="Job orders" value={p.jobOrders.length} sub={`${p.jobOrders.filter((j) => j.status === "OPEN").length} open`} />
        <Figure label="Candidates supplied" value={supplied.length} />
        <Figure label="Selected" value={selected} sub="in process or deployed" />
        <Figure label="Deployed" value={deployed} tone="green" />
        {fin && <Figure label="They owe us" value={money(m.theyOweOut, { cur: false })} sub={`${money(m.theyPaid)} received so far`} tone={m.theyOweOut > 0 ? "amber" : undefined} />}
        {fin && <Figure label="We owe them" value={money(m.weOweOut, { cur: false })} sub={`${money(m.wePaid)} paid so far`} />}
      </Figures>

      <div className="grid gap-5 mt-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5 min-w-0">
          <Section title="Job orders from this partner" flush actions={can(r, "jobs.manage") && <Link className="link text-[12.5px]" href={`/jobs/new?partner=${p.id}`}>+ Add job order</Link>}>
            {p.jobOrders.length === 0 ? <Empty>No job orders received.</Empty> : (
              <TableWrap>
                <table className="grid-table">
                  <thead><tr><th>Reference</th><th>Position</th><th>Status</th><th className="r">Vacancies</th><th className="r">Selected</th><th className="r">Deployed</th><th>Received</th></tr></thead>
                  <tbody>
                    {p.jobOrders.map((j) => (
                      <tr key={j.id}>
                        <td className="num"><Link className="row-link" href={`/jobs/${j.id}`}>{j.reference}</Link></td>
                        <td>{j.position}<div className="text-[12px] text-muted">{j.employer}</div></td>
                        <td><JobStatusTag status={j.status} /></td>
                        <td className="r num">{j.vacancies}</td>
                        <td className="r num">{j.candidates.filter((c) => ["IN_PROCESS", "DEPLOYED"].includes(c.status)).length}</td>
                        <td className="r num">{j.candidates.filter((c) => c.status === "DEPLOYED").length}</td>
                        <td className="text-[13px] whitespace-nowrap">{d(j.receivedOn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Section>

          <Section title="Candidates" note={`${supplied.length} supplied by them · ${onTheirJobs.length} on their job orders`} flush>
            {cands.length === 0 ? <Empty>No candidates linked.</Empty> : (
              <TableWrap>
                <table className="grid-table">
                  <thead><tr><th>Candidate</th><th>Link</th><th>Job order</th><th>Status</th><th>Stage</th></tr></thead>
                  <tbody>
                    {cands.slice(0, 60).map((c) => (
                      <tr key={c.id}>
                        <td><Link className="row-link" href={`/candidates/${c.id}`}>{c.fullName}</Link></td>
                        <td className="text-[13px]">{c.sourcePartnerId === id && c.jobOrder?.partnerId === id ? "Supplied, their job" : c.sourcePartnerId === id ? "Supplied by them" : "Submitted to them"}</td>
                        <td className="num text-[13px]">{c.jobOrder?.reference ?? "—"}</td>
                        <td><StatusTag status={c.status} /></td>
                        <td><StageTag stage={c.stage} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Section>

          {fin && (
            <Section title="Money with this partner" flush>
              <div className="grid sm:grid-cols-2 border-b border-rule">
                <div className="px-4 py-3 sm:border-r border-rule">
                  <div className="label-caps">They owe us</div>
                  <div className="text-[13px] mt-1">Invoiced <Money v={m.theyOwe} /> · received <Money v={m.theyPaid} /> · <b>outstanding <Money v={m.theyOweOut} /></b></div>
                </div>
                <div className="px-4 py-3">
                  <div className="label-caps">We owe them</div>
                  <div className="text-[13px] mt-1">Owed <Money v={m.weOwe} /> · paid <Money v={m.wePaid} /> · <b>outstanding <Money v={m.weOweOut} /></b></div>
                </div>
              </div>
              {p.entries.length === 0 ? <Empty>No entries.</Empty> : (
                <TableWrap>
                  <table className="grid-table">
                    <thead><tr><th>Date</th><th>Entry</th><th>Reference</th><th>Due</th><th className="r">They owe us</th><th className="r">We owe them</th><th></th></tr></thead>
                    <tbody>
                      {p.entries.map((e) => {
                        const sign = e.kind === "CHARGE" ? 1 : -1;
                        const label = e.direction === "RECEIVABLE" ? (e.kind === "CHARGE" ? "Invoice" : "Received") : e.kind === "CHARGE" ? "Commission due" : "Paid out";
                        return (
                          <tr key={e.id}>
                            <td className="whitespace-nowrap">{d(e.date)}</td>
                            <td><Tag tone={e.kind === "PAYMENT" ? "green" : "plain"}>{label}</Tag> {e.description}{e.jobOrder && <span className="text-[12px] text-muted"> · {e.jobOrder.reference}</span>}</td>
                            <td className="num text-[12.5px]">{e.reference ?? "—"}{e.method && <div className="text-muted">{PAYMENT_METHOD_LABEL[e.method as keyof typeof PAYMENT_METHOD_LABEL]}</div>}</td>
                            <td className={cx("whitespace-nowrap", e.dueDate && e.dueDate < now && e.kind === "CHARGE" && "text-warn")}>{e.dueDate ? d(e.dueDate, "d MMM") : ""}</td>
                            <td className="r">{e.direction === "RECEIVABLE" ? <Money v={sign * e.amount} /> : ""}</td>
                            <td className="r">{e.direction === "PAYABLE" ? <Money v={sign * e.amount} /> : ""}</td>
                            <td className="text-right"><ActionButton action={deletePartnerEntry.bind(null, e.id)} variant="ghost" confirm="Delete this entry? It will be logged.">Delete</ActionButton></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
              )}
              <div className="p-4 border-t border-rule">
                <Disclose label="Add invoice, payment or commission">
                  <ActionForm action={addPartnerEntry.bind(null, p.id)} className="space-y-3 pt-2">
                    <FormGrid cols={4}>
                      <Field label="Who owes"><Select name="direction" options={[{ value: "RECEIVABLE", label: "Partner owes us" }, { value: "PAYABLE", label: "We owe partner" }]} /></Field>
                      <Field label="Entry"><Select name="kind" options={[{ value: "CHARGE", label: "New amount owed" }, { value: "PAYMENT", label: "Payment made" }]} /></Field>
                      <Field label="Amount (AED)" required><Input name="amount" className="num" required /></Field>
                      <Field label="Date"><Input name="date" type="date" defaultValue={toDateInput(now)} /></Field>
                      <Field label="Description" required className="sm:col-span-2"><Input name="description" required placeholder="Service fee for 4 workers, May arrivals" /></Field>
                      <Field label="Due date (for amounts owed)"><Input name="dueDate" type="date" /></Field>
                      <Field label="Reference"><Input name="reference" /></Field>
                      <Field label="Method (for payments)"><Select name="method" placeholder="—" options={PAYMENT_METHODS} /></Field>
                      <Field label="Job order"><Select name="jobOrderId" placeholder="—" options={p.jobOrders.map((j) => ({ value: j.id, label: j.reference }))} /></Field>
                    </FormGrid>
                    <Submit>Save entry</Submit>
                  </ActionForm>
                </Disclose>
              </div>
            </Section>
          )}

          <Section title="Communication" flush>
            {can(r, "partners.manage") && (
              <div className="p-4 border-b border-rule">
                <ActionForm action={addPartnerNote.bind(null, p.id)} className="space-y-2.5">
                  <Textarea name="body" rows={2} required placeholder="What was discussed, what was agreed" className="control" />
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Channel"><Select name="channel" options={[{ value: "CALL", label: "Call" }, { value: "WHATSAPP", label: "WhatsApp" }, { value: "EMAIL", label: "Email" }, { value: "MEETING", label: "Meeting" }]} className="!w-[130px]" /></Field>
                    <Field label="Next follow-up"><Input name="nextFollowUp" type="date" className="!w-[160px]" /></Field>
                    <Submit>Save note</Submit>
                  </div>
                </ActionForm>
              </div>
            )}
            {p.partnerNotes.length === 0 ? <Empty>No notes yet.</Empty> : (
              <ul className="divide-y divide-rule">
                {p.partnerNotes.map((n) => (
                  <li key={n.id} className="px-4 py-3">
                    <div className="text-[12px] text-muted">{n.user.name} · {n.channel.toLowerCase()} · {dt(n.createdAt)}{n.nextFollowUp && ` · follow up ${d(n.nextFollowUp, "d MMM")}`}</div>
                    <p className="text-[13.5px] mt-0.5 whitespace-pre-line">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Terms">
            <KV items={[
              ["Service fee / worker", p.serviceFeePerWorker ? money(p.serviceFeePerWorker) : null],
              ["Commission", p.commission],
              ["Payment terms", p.paymentTerms],
              ["Phone", p.phone ? <span className="num">{p.phone}</span> : null],
              ["Email", p.email],
              ["Address", p.address],
              ["Website", p.website],
            ]} />
            {p.notes && <p className="text-[13px] mt-3 pt-3 border-t border-rule whitespace-pre-line">{p.notes}</p>}
          </Section>

          <Section title="Contact persons" flush>
            {p.contacts.length === 0 ? <Empty>None added.</Empty> : (
              <ul className="divide-y divide-rule">
                {p.contacts.map((c) => (
                  <li key={c.id} className="px-4 py-3 text-[13px]">
                    <div className="flex justify-between"><span className="font-medium">{c.name}</span>{can(r, "partners.manage") && <ActionButton action={deleteContact.bind(null, c.id)} variant="ghost" className="!h-5 text-muted text-[11.5px]" confirm="Remove contact?">remove</ActionButton>}</div>
                    {c.position && <div className="text-muted">{c.position}</div>}
                    <div className="num text-[12.5px]">{c.phone}{c.email && <> · <a className="link" href={`mailto:${c.email}`}>{c.email}</a></>}</div>
                    {(c.phone || c.whatsapp) && <ContactButtons phone={c.phone} whatsapp={c.whatsapp} className="mt-1.5" />}
                  </li>
                ))}
              </ul>
            )}
            {can(r, "partners.manage") && (
              <div className="p-3 border-t border-rule">
                <Disclose label="Add contact">
                  <ActionForm action={addContact.bind(null, p.id)} className="space-y-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Name"><Input name="name" required /></Field>
                      <Field label="Position"><Input name="position" /></Field>
                      <Field label="Phone"><Input name="phone" /></Field>
                      <Field label="WhatsApp"><Input name="whatsapp" /></Field>
                    </div>
                    <Field label="Email"><Input name="email" type="email" /></Field>
                    <Submit size="sm">Add</Submit>
                  </ActionForm>
                </Disclose>
              </div>
            )}
          </Section>

          <Section title="Agreements & contracts" flush>
            {p.agreements.length === 0 ? <Empty>No signed agreement on file.</Empty> : (
              <ul className="divide-y divide-rule">
                {p.agreements.map((a) => (
                  <li key={a.id} className="px-4 py-3 text-[13px]">
                    <div className="flex justify-between gap-2">
                      {a.fileUrl ? <a className="link font-medium" href={a.fileUrl} target="_blank" rel="noreferrer">{a.title}</a> : <span className="font-medium">{a.title}</span>}
                      {can(r, "partners.manage") && <ActionButton action={deleteAgreement.bind(null, a.id)} variant="ghost" className="!h-5 text-muted text-[11.5px]" confirm="Remove agreement?">remove</ActionButton>}
                    </div>
                    <div className="text-muted">Signed {d(a.signedOn)} · <span className={cx(a.expiresOn && a.expiresOn < now ? "text-danger font-medium" : a.expiresOn && a.expiresOn < addDays(now, a.remindDays) ? "text-warn font-medium" : "")}>expires {d(a.expiresOn)}</span></div>
                    <div className="text-[12px] text-muted">Reminder {a.remindDays} days before{!a.fileUrl && " · no file attached"}</div>
                  </li>
                ))}
              </ul>
            )}
            {can(r, "partners.manage") && (
              <div className="p-3 border-t border-rule">
                <Disclose label="Add agreement">
                  <ActionForm action={addAgreement.bind(null, p.id)} className="space-y-2 pt-2">
                    <Field label="Title"><Input name="title" required defaultValue="Cooperation agreement" /></Field>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Signed"><Input name="signedOn" type="date" /></Field>
                      <Field label="Expires"><Input name="expiresOn" type="date" /></Field>
                      <Field label="Remind (days)"><Input name="remindDays" type="number" defaultValue={30} /></Field>
                    </div>
                    <Field label="Signed copy (PDF)"><Input name="file" type="file" accept=".pdf,image/*" /></Field>
                    <Submit size="sm">Save</Submit>
                  </ActionForm>
                </Disclose>
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
