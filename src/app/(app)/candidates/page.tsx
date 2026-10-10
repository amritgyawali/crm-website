import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { addDays, subDays } from "date-fns";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ranges } from "@/lib/dates";
import { getDueInstallments } from "@/lib/dues";
import { getSettings, num } from "@/lib/settings";
import { CANDIDATE_STATUS, CLOSED_STATUSES, LEAD_SOURCES, LEAD_SOURCE_LABEL, STAGES, type CandidateStatus } from "@/lib/constants";
import { dShort, relDays } from "@/lib/format";
import { Empty, Input, LinkButton, Money, PageHeader, Section, Select, TableWrap, btn, cx } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { FilterForm } from "@/components/filter-form";
import { Pager } from "@/components/pager";
import { SelectAll } from "@/components/select-all";
import { StageTag, StatusTag } from "@/components/tags";
import { bulkAssign } from "./actions";
import { Suspense } from "react";
import { KeyHint, RowNav } from "@/components/row-nav";
import { SavedViews } from "@/components/saved-views";

export const metadata = { title: "Candidates" };
const PER = 50;

type SP = { q?: string; status?: string; source?: string; job?: string; staff?: string; stage?: string; page?: string; mine?: string; view?: string; sort?: string };

const SORTS: Record<string, Prisma.CandidateOrderByWithRelationInput> = {
  new: { createdAt: "desc" },
  old: { createdAt: "asc" },
  name: { fullName: "asc" },
  lastcall: { lastContactedAt: { sort: "asc", nulls: "first" } },
  nextcall: { nextCallAt: { sort: "asc", nulls: "last" } },
};

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const s = await getSettings();
  const page = Math.max(1, Number(sp.page) || 1);
  const r = ranges();
  // sales staff start on their own candidates; a search always looks through everyone to avoid duplicates
  const salesDefault = user.role === "SALES" && !can(user.role, "calls.viewAll");
  const mineOnly = sp.mine === "1" || (salesDefault && sp.mine !== "0" && !sp.q);

  const where: Prisma.CandidateWhereInput = {};
  const and: Prisma.CandidateWhereInput[] = [];
  if (sp.q) {
    const q = sp.q.trim();
    and.push({ OR: [
      { fullName: { contains: q } }, { phone: { contains: q.replace(/\s/g, "") } }, { passportNo: { contains: q } },
      { code: { contains: q.toUpperCase() } }, { email: { contains: q } },
    ] });
  }
  if (sp.status === "OPEN") where.status = { in: ["LEAD", "CONTACTED", "INTERESTED", "ENROLLED", "IN_PROCESS"] };
  else if (sp.status) where.status = sp.status;
  if (sp.source) where.leadSource = sp.source;
  if (sp.job) where.jobOrderId = sp.job;
  if (sp.stage) where.stage = sp.stage;
  if (sp.staff === "none") where.assignedToId = null;
  else if (sp.staff) where.assignedToId = sp.staff;
  if (mineOnly) where.assignedToId = user.id;

  // quick views
  if (sp.view === "overdue" || sp.view === "week") {
    const dues = await getDueInstallments({ until: sp.view === "overdue" ? subDays(r.todayStart, 0) : r.weekEnd, assignedToId: mineOnly ? user.id : undefined });
    const ids = [...new Set(dues.filter((x) => (sp.view === "overdue" ? x.dueDate < r.todayStart : x.dueDate >= r.todayStart)).map((x) => x.candidateId))];
    and.push({ id: { in: ids } });
  } else if (sp.view === "stale") {
    const cutoff = subDays(r.now, num(s.leadNoContactDays, 2));
    and.push({ status: { in: ["LEAD", "CONTACTED", "INTERESTED"] }, nextCallAt: null });
    and.push({ OR: [{ lastContactedAt: null, createdAt: { lt: cutoff } }, { lastContactedAt: { lt: cutoff } }] });
  } else if (sp.view === "unassigned") {
    and.push({ assignedToId: null, status: { notIn: CLOSED_STATUSES } });
  } else if (sp.view === "callbacks") {
    and.push({ nextCallAt: { lte: r.todayEnd }, status: { notIn: CLOSED_STATUSES } });
  } else if (sp.view === "passport") {
    and.push({ status: { in: ["INTERESTED", "ENROLLED", "IN_PROCESS"] }, passportExpiry: { lt: addDays(r.now, 365) } });
  }
  if (and.length) where.AND = and;

  const sort = sp.sort && SORTS[sp.sort] ? sp.sort : sp.view === "callbacks" ? "nextcall" : "new";
  const [total, rows, jobs, staff] = await Promise.all([
    db.candidate.count({ where }),
    db.candidate.findMany({
      where,
      orderBy: SORTS[sort],
      skip: (page - 1) * PER,
      take: PER,
      select: {
        id: true, code: true, fullName: true, phone: true, nationality: true, status: true, stage: true, leadSource: true,
        agreedAmount: true, lastContactedAt: true, nextCallAt: true, createdAt: true,
        jobOrder: { select: { position: true, country: true } },
        assignedTo: { select: { name: true } },
        campaign: { select: { name: true } },
      },
    }),
    db.jobOrder.findMany({ select: { id: true, reference: true, position: true }, orderBy: { receivedOn: "desc" } }),
    db.user.findMany({ where: { active: true, role: { in: ["SALES", "MANAGEMENT", "OPERATIONS"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const paid = await db.payment.groupBy({ by: ["candidateId"], where: { candidateId: { in: rows.map((x) => x.id) } }, _sum: { amount: true } });
  const paidMap = new Map(paid.map((p) => [p.candidateId, p._sum.amount ?? 0]));
  const pages = Math.ceil(total / PER);
  const now = new Date();
  const canBulk = can(user.role, "candidate.assign");

  const link = (patch: Partial<SP>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/candidates${q.size ? `?${q}` : ""}`;
  };
  const views = [
    { key: "", label: "All" },
    { key: "overdue", label: "Fees overdue" },
    { key: "week", label: "Due this week" },
    { key: "callbacks", label: "Call-backs due" },
    { key: "stale", label: "Not contacted" },
    { key: "unassigned", label: "No staff" },
    { key: "passport", label: "Passport expiring" },
  ];
  const SortHead = ({ k, children, className }: { k: string; children: React.ReactNode; className?: string }) => (
    <th className={className}>
      <Link href={link({ sort: k })} className={cx("no-underline hover:text-ink", sort === k && "text-ink")}>{children}{sort === k ? " ↓" : ""}</Link>
    </th>
  );
  const filtered = sp.q || sp.status || sp.source || sp.job || sp.staff || sp.stage || sp.view;

  return (
    <>
      <PageHeader
        title="Candidates"
        meta={<span><span className="num">{total}</span> {filtered ? "matching" : "on record"}{mineOnly ? " · assigned to you" : ""}</span>}
        actions={
          <>
            <Link href={link({ mine: mineOnly ? (salesDefault ? "0" : undefined) : "1" })} className={btn("ghost")}>{mineOnly ? "Show everyone's" : "Only mine"}</Link>
            {can(user.role, "reports.view") && <a className={btn("secondary")} href={`/api/export/candidates?${new URLSearchParams(sp as Record<string, string>)}`}>Export</a>}
            {can(user.role, "candidate.edit") && <LinkButton href="/candidates/import">Import</LinkButton>}
            {can(user.role, "candidate.edit") && <LinkButton href="/candidates/new" variant="primary">New candidate</LinkButton>}
          </>
        }
      />

      <nav className="flex flex-wrap gap-1.5 mb-3" aria-label="Quick views">
        {views.map((v) => (
          <Link key={v.key} href={link({ view: v.key || undefined, sort: undefined })}
            className={cx("px-2.5 h-7 inline-flex items-center rounded-[3px] border text-[12.5px] no-underline", (sp.view ?? "") === v.key ? "bg-ink text-paper border-ink" : "bg-field border-rule-2 text-ink-2 hover:border-ink-2")}>
            {v.label}
          </Link>
        ))}
      </nav>

      <Suspense fallback={null}><SavedViews storageKey="candidates" /></Suspense>

      <FilterForm>
        <Input name="q" defaultValue={sp.q} placeholder="Name, phone, passport, code" className="!w-[240px]" />
        <Select name="status" defaultValue={sp.status ?? ""} placeholder="Any status" options={[{ value: "OPEN", label: "All open cases" }, ...CANDIDATE_STATUS]} className="!w-[160px]" />
        <Select name="stage" defaultValue={sp.stage ?? ""} placeholder="Any stage" options={STAGES.map((st) => ({ value: st.value, label: st.short }))} className="!w-[150px]" />
        <Select name="source" defaultValue={sp.source ?? ""} placeholder="Any source" options={LEAD_SOURCES} className="!w-[140px]" />
        <Select name="job" defaultValue={sp.job ?? ""} placeholder="Any job order" options={jobs.map((j) => ({ value: j.id, label: `${j.reference} · ${j.position}` }))} className="!w-[220px]" />
        {can(user.role, "calls.viewAll") && (
          <Select name="staff" defaultValue={sp.staff ?? ""} placeholder="Any staff" options={[{ value: "none", label: "Not assigned" }, ...staff.map((u) => ({ value: u.id, label: u.name }))]} className="!w-[160px]" />
        )}
        {sp.mine && <input type="hidden" name="mine" value={sp.mine} />}
        {sp.view && <input type="hidden" name="view" value={sp.view} />}
        {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
        <button className={btn("secondary")}>Search</button>
        {filtered && <Link href="/candidates" className="link text-[13px] self-center">Clear</Link>}
      </FilterForm>

      {canBulk && rows.length > 0 && (
        <ActionForm id="bulk" action={bulkAssign} className="flex flex-wrap items-center gap-2 mb-3 text-[13px]">
          <span className="text-muted">With ticked:</span>
          <select name="assignTo" className="control !w-[200px] !min-h-[30px] !py-0.5" defaultValue="">
            <option value="" disabled>Assign to…</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <Submit size="sm" variant="secondary">Assign</Submit>
        </ActionForm>
      )}

      <Section flush>
        {rows.length === 0 ? (
          <Empty>No candidates match. Try a shorter search, or clear the filters.</Empty>
        ) : (
          <>
          {/* phones: one card per candidate */}
          <ul className="md:hidden divide-y divide-rule">
            {rows.map((c) => {
              const bal = c.agreedAmount - (paidMap.get(c.id) ?? 0);
              const closed = CLOSED_STATUSES.includes(c.status as CandidateStatus);
              return (
                <li key={c.id}>
                  <Link href={`/candidates/${c.id}`} className="block px-4 py-3 no-underline active:bg-hover">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.fullName}</div>
                        <div className="text-[12px] text-muted truncate">{c.jobOrder ? `${c.jobOrder.position}, ${c.jobOrder.country}` : c.nationality} · {c.assignedTo?.name ?? "no staff"}</div>
                      </div>
                      <StatusTag status={c.status} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[12px]">
                      <span className={cx(c.nextCallAt && c.nextCallAt < now ? "text-danger" : "text-muted")}>{c.nextCallAt ? `Call ${dShort(c.nextCallAt)}` : c.lastContactedAt ? `Last call ${relDays(c.lastContactedAt, now)}` : "Never called"}</span>
                      {c.agreedAmount > 0 && !closed && <span className="num">{bal > 0 ? `${Math.round(bal).toLocaleString()} due` : "Paid"}</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="hidden md:block">
          <RowNav>
          <TableWrap>
            <table className="grid-table">
              <thead>
                <tr>
                  {canBulk && <th className="w-8"><SelectAll form="bulk" /></th>}
                  <SortHead k="name">Candidate</SortHead>
                  <th>Status</th>
                  <th>Job order</th>
                  <th>Source</th>
                  <th>Staff</th>
                  <SortHead k="lastcall">Last call</SortHead>
                  <SortHead k="nextcall">Next call</SortHead>
                  <th className="r">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const bal = c.agreedAmount - (paidMap.get(c.id) ?? 0);
                  const closed = CLOSED_STATUSES.includes(c.status as CandidateStatus);
                  return (
                    <tr key={c.id}>
                      {canBulk && <td><input type="checkbox" name="ids" value={c.id} form="bulk" aria-label={`Select ${c.fullName}`} /></td>}
                      <td>
                        <Link href={`/candidates/${c.id}`} className="row-link">{c.fullName}</Link>
                        <div className="text-[12px] text-muted"><span className="num">{c.code}</span> · {c.nationality} · <span className="num">{c.phone}</span></div>
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <StatusTag status={c.status} />
                          {c.stage && !closed && <StageTag stage={c.stage} />}
                        </div>
                      </td>
                      <td className="text-[13px]">{c.jobOrder ? <>{c.jobOrder.position}<div className="text-[12px] text-muted">{c.jobOrder.country}</div></> : <span className="text-muted">—</span>}</td>
                      <td className="text-[13px]">
                        {LEAD_SOURCE_LABEL[c.leadSource as keyof typeof LEAD_SOURCE_LABEL]}
                        {c.campaign && <div className="text-[12px] text-muted max-w-[180px] truncate">{c.campaign.name}</div>}
                      </td>
                      <td className="text-[13px]">{c.assignedTo?.name ?? <span className="text-warn">Not assigned</span>}</td>
                      <td className="text-[13px] whitespace-nowrap">{c.lastContactedAt ? relDays(c.lastContactedAt, now) : <span className="text-muted">never</span>}</td>
                      <td className={cx("text-[13px] whitespace-nowrap", c.nextCallAt && c.nextCallAt < now && "text-danger font-medium")}>{c.nextCallAt ? dShort(c.nextCallAt) : "—"}</td>
                      <td className="r">{c.agreedAmount > 0 && !closed ? <Money v={bal} zero="Paid" /> : <span className="text-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          </RowNav>
          <div className="px-4 py-2 border-t border-rule flex justify-end"><KeyHint /></div>
          </div>
          </>
        )}
        <Pager page={page} pages={pages} params={sp as Record<string, string>} base="/candidates" />
      </Section>
    </>
  );
}
