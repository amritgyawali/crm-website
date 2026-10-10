import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { computeLedger } from "@/lib/ledger";
import { PLATFORM_LABEL, STAGES, CLOSED_STATUSES, type CandidateStatus } from "@/lib/constants";
import { d, money } from "@/lib/format";
import { Empty, Figure, Figures, KV, LinkButton, Money, PageHeader, Section, TableWrap, cx } from "@/components/ui";
import { JobStatusTag, StageTag, StatusTag } from "@/components/tags";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const j = await db.jobOrder.findUnique({ where: { id: (await params).id }, select: { reference: true } });
  return { title: j?.reference ?? "Job order" };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const j = await db.jobOrder.findUnique({
    where: { id },
    include: {
      partner: true,
      feePackages: { include: { steps: true } },
      campaigns: { include: { _count: { select: { candidates: true } } } },
      candidates: {
        orderBy: { createdAt: "desc" },
        include: { installments: true, payments: { select: { amount: true } }, assignedTo: { select: { name: true } } },
      },
    },
  });
  if (!j) notFound();

  const ledgers = j.candidates.map((c) => ({ c, L: computeLedger(c) }));
  const by = (st: CandidateStatus[]) => j.candidates.filter((c) => st.includes(c.status as CandidateStatus)).length;
  const collected = ledgers.reduce((s, x) => s + x.L.paid, 0);
  const owed = ledgers.reduce((s, x) => s + x.L.balance, 0);
  const deployed = by(["DEPLOYED"]);

  return (
    <>
      <PageHeader
        back={{ href: "/jobs", label: "Job orders" }}
        title={<>{j.position} <span className="text-muted font-normal">· {j.country}</span></>}
        meta={<><span className="num">{j.reference}</span><JobStatusTag status={j.status} /><span>{j.employer}</span>{j.partner && <Link className="link" href={`/partners/${j.partner.id}`}>{j.partner.name}</Link>}</>}
        actions={
          <>
            {can(user.role, "candidate.edit") && <LinkButton href={`/candidates/new?job=${j.id}`}>Add candidate</LinkButton>}
            {can(user.role, "jobs.manage") && <LinkButton href={`/jobs/${j.id}/edit`}>Edit</LinkButton>}
          </>
        }
      />
      <Figures cols={6}>
        <Figure label="Vacancies" value={j.vacancies} sub={`${Math.max(j.vacancies - deployed, 0)} still to fill`} />
        <Figure label="Leads" value={by(["LEAD", "CONTACTED", "INTERESTED"])} />
        <Figure label="Enrolled" value={by(["ENROLLED"])} />
        <Figure label="In process" value={by(["IN_PROCESS"])} />
        <Figure label="Deployed" value={deployed} tone="green" />
        <Figure label="Fees collected" value={money(collected, { cur: false, whole: true })} sub={`${money(owed, { whole: true })} still owed`} />
      </Figures>

      <div className="grid gap-5 mt-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5 min-w-0">
          <Section title="Pipeline" flush>
            <div className="grid grid-cols-3 sm:grid-cols-9 border-b border-rule">
              {STAGES.map((st, i) => {
                const n = j.candidates.filter((c) => c.stage === st.value && !CLOSED_STATUSES.includes(c.status as CandidateStatus)).length;
                return (
                  <div key={st.value} className="px-2 py-3 border-r border-rule last:border-r-0 text-center">
                    <div className={cx("num text-[20px]", !n && "text-rule-2")}>{n}</div>
                    <div className="text-[11px] text-muted leading-tight mt-0.5">{i + 1}. {st.short}</div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Candidates" note={`${j.candidates.length} linked`} flush>
            {j.candidates.length === 0 ? <Empty>No candidates linked yet.</Empty> : (
              <TableWrap>
                <table className="grid-table">
                  <thead><tr><th>Candidate</th><th>Status</th><th>Stage</th><th>Staff</th><th className="r">Paid</th><th className="r">Balance</th></tr></thead>
                  <tbody>
                    {ledgers.map(({ c, L }) => (
                      <tr key={c.id}>
                        <td><Link className="row-link" href={`/candidates/${c.id}`}>{c.fullName}</Link><div className="text-[12px] text-muted">{c.nationality}</div></td>
                        <td><StatusTag status={c.status} /></td>
                        <td><StageTag stage={c.stage} /></td>
                        <td className="text-[13px]">{c.assignedTo?.name ?? "—"}</td>
                        <td className="r"><Money v={L.paid} zero="—" /></td>
                        <td className={cx("r", L.overdue > 0 && "text-danger")}><Money v={L.balance} zero="—" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Details">
            <KV items={[
              ["Employer", j.employer],
              ["City", j.city],
              ["Salary", j.salary],
              ["Contract", `${j.contractMonths} months`],
              ["Received", d(j.receivedOn)],
              ["Deadline", d(j.deadline)],
              ["Partner", j.partner ? <Link className="link" href={`/partners/${j.partner.id}`}>{j.partner.name}</Link> : "Direct employer"],
              ["Service fee", j.partner?.serviceFeePerWorker ? `${money(j.partner.serviceFeePerWorker)} / worker` : null],
            ]} />
            {j.requirements && <p className="text-[13px] mt-3 pt-3 border-t border-rule whitespace-pre-line">{j.requirements}</p>}
          </Section>
          <Section title="Fee packages" flush>
            {j.feePackages.length === 0 ? <Empty>No package for this job. {can(user.role, "packages.manage") && <Link className="link" href="/finance/packages">Create one</Link>}</Empty> : (
              <ul className="divide-y divide-rule">
                {j.feePackages.map((p) => (
                  <li key={p.id} className="px-4 py-2.5 text-[13px] flex justify-between gap-2"><span>{p.name}<div className="text-[12px] text-muted">{p.steps.length} installments{p.active ? "" : " · retired"}</div></span><span className="num">{money(p.totalAmount)}</span></li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Campaigns promoting this job" flush>
            {j.campaigns.length === 0 ? <Empty>None.</Empty> : (
              <ul className="divide-y divide-rule">
                {j.campaigns.map((c) => (
                  <li key={c.id} className="px-4 py-2.5 text-[13px]"><Link className="row-link" href={`/campaigns/${c.id}`}>{c.name}</Link><div className="text-[12px] text-muted">{PLATFORM_LABEL[c.platform as keyof typeof PLATFORM_LABEL]} · {c._count.candidates} leads · {money(c.amountSpent)} spent</div></li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
