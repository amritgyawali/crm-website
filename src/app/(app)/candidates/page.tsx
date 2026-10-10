import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CANDIDATE_STATUS, LEAD_SOURCES, LEAD_SOURCE_LABEL, STAGES, type CandidateStatus } from "@/lib/constants";
import { dShort, relDays } from "@/lib/format";
import { Empty, Input, LinkButton, Money, PageHeader, Section, Select, TableWrap, btn } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { Pager } from "@/components/pager";
import { StageTag, StatusTag } from "@/components/tags";

export const metadata = { title: "Candidates" };
const PER = 50;

type SP = { q?: string; status?: string; source?: string; job?: string; staff?: string; stage?: string; page?: string; mine?: string };

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.CandidateWhereInput = {};
  if (sp.q) {
    const q = sp.q.trim();
    where.OR = [
      { fullName: { contains: q } }, { phone: { contains: q.replace(/\s/g, "") } }, { passportNo: { contains: q } },
      { code: { contains: q.toUpperCase() } }, { email: { contains: q } },
    ];
  }
  if (sp.status === "OPEN") where.status = { in: ["LEAD", "CONTACTED", "INTERESTED", "ENROLLED", "IN_PROCESS"] };
  else if (sp.status) where.status = sp.status;
  if (sp.source) where.leadSource = sp.source;
  if (sp.job) where.jobOrderId = sp.job;
  if (sp.stage) where.stage = sp.stage;
  if (sp.staff === "none") where.assignedToId = null;
  else if (sp.staff) where.assignedToId = sp.staff;
  if (sp.mine === "1") where.assignedToId = user.id;

  const [total, rows, jobs, staff] = await Promise.all([
    db.candidate.count({ where }),
    db.candidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
  const paid = await db.payment.groupBy({ by: ["candidateId"], where: { candidateId: { in: rows.map((r) => r.id) } }, _sum: { amount: true } });
  const paidMap = new Map(paid.map((p) => [p.candidateId, p._sum.amount ?? 0]));
  const pages = Math.ceil(total / PER);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Candidates"
        meta={<span><span className="num">{total}</span> {sp.q || sp.status || sp.source || sp.job || sp.staff || sp.stage ? "matching" : "on record"}</span>}
        actions={
          <>
            <Link href={sp.mine === "1" ? "/candidates" : "/candidates?mine=1"} className={btn("ghost")}>{sp.mine === "1" ? "Show everyone's" : "Only mine"}</Link>
            {can(user.role, "reports.view") && <a className={btn("secondary")} href={`/api/export/candidates?${new URLSearchParams(sp as Record<string, string>)}`}>Export</a>}
            {can(user.role, "candidate.edit") && <LinkButton href="/candidates/new" variant="primary">New candidate</LinkButton>}
          </>
        }
      />

      <FilterForm>
        <Input name="q" defaultValue={sp.q} placeholder="Name, phone, passport, code" className="!w-[240px]" />
        <Select name="status" defaultValue={sp.status ?? ""} placeholder="Any status" options={[{ value: "OPEN", label: "All open cases" }, ...CANDIDATE_STATUS]} className="!w-[160px]" />
        <Select name="stage" defaultValue={sp.stage ?? ""} placeholder="Any stage" options={STAGES.map((s) => ({ value: s.value, label: s.short }))} className="!w-[150px]" />
        <Select name="source" defaultValue={sp.source ?? ""} placeholder="Any source" options={LEAD_SOURCES} className="!w-[140px]" />
        <Select name="job" defaultValue={sp.job ?? ""} placeholder="Any job order" options={jobs.map((j) => ({ value: j.id, label: `${j.reference} · ${j.position}` }))} className="!w-[220px]" />
        {can(user.role, "calls.viewAll") && (
          <Select name="staff" defaultValue={sp.staff ?? ""} placeholder="Any staff" options={[{ value: "none", label: "Not assigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} className="!w-[160px]" />
        )}
        {sp.mine && <input type="hidden" name="mine" value={sp.mine} />}
        <button className={btn("secondary")}>Search</button>
        {(sp.q || sp.status || sp.source || sp.job || sp.staff || sp.stage) && <Link href="/candidates" className="link text-[13px] self-center">Clear</Link>}
      </FilterForm>

      <Section flush>
        {rows.length === 0 ? (
          <Empty>No candidates match. Try a shorter search, or clear the filters.</Empty>
        ) : (
          <TableWrap>
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Status</th>
                  <th>Job order</th>
                  <th>Source</th>
                  <th>Staff</th>
                  <th>Last call</th>
                  <th>Next call</th>
                  <th className="r">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const bal = c.agreedAmount - (paidMap.get(c.id) ?? 0);
                  const closed = ["WITHDRAWN", "REFUSED", "NOT_ELIGIBLE", "NOT_INTERESTED"].includes(c.status as CandidateStatus);
                  return (
                    <tr key={c.id}>
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
                      <td className={`text-[13px] whitespace-nowrap ${c.nextCallAt && c.nextCallAt < now ? "text-danger font-medium" : ""}`}>{c.nextCallAt ? dShort(c.nextCallAt) : "—"}</td>
                      <td className="r">{c.agreedAmount > 0 && !closed ? <Money v={bal} zero="Paid" /> : <span className="text-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
        <Pager page={page} pages={pages} params={sp as Record<string, string>} base="/candidates" />
      </Section>
    </>
  );
}
