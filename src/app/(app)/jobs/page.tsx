import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { JOB_STATUS } from "@/lib/constants";
import { d } from "@/lib/format";
import { Bar, Empty, LinkButton, PageHeader, Section, Select, TableWrap } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { JobStatusTag } from "@/components/tags";
import { RowNav } from "@/components/row-nav";

export const metadata = { title: "Job orders" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string; country?: string; partner?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [jobs, counts, partners] = await Promise.all([
    db.jobOrder.findMany({
      where: { ...(sp.status ? { status: sp.status } : { status: { in: ["OPEN", "ON_HOLD"] } }), ...(sp.country ? { country: sp.country } : {}), ...(sp.partner ? { partnerId: sp.partner } : {}) },
      orderBy: { receivedOn: "desc" },
      include: { partner: { select: { id: true, name: true } } },
    }),
    db.candidate.groupBy({ by: ["jobOrderId", "status"], _count: true }),
    db.partner.findMany({ where: { type: { in: ["JOB_ORDERS", "BOTH"] } }, orderBy: { name: "asc" } }),
  ]);
  const count = (jobId: string, statuses: string[]) => counts.filter((c) => c.jobOrderId === jobId && statuses.includes(c.status)).reduce((s, c) => s + c._count, 0);
  const countries = [...new Set((await db.jobOrder.findMany({ select: { country: true } })).map((j) => j.country))].sort();

  return (
    <>
      <PageHeader
        title="Job orders"
        meta="Demand received from partners and direct employers."
        actions={can(user.role, "jobs.manage") && <LinkButton href="/jobs/new" variant="primary">New job order</LinkButton>}
      />
      <FilterForm>
        <Select name="status" defaultValue={sp.status ?? ""} placeholder="Open & on hold" options={JOB_STATUS} className="!w-[160px]" />
        <Select name="country" defaultValue={sp.country ?? ""} placeholder="All countries" options={countries.map((c) => ({ value: c, label: c }))} className="!w-[170px]" />
        <Select name="partner" defaultValue={sp.partner ?? ""} placeholder="All partners" options={partners.map((p) => ({ value: p.id, label: p.name }))} className="!w-[220px]" />
      </FilterForm>
      <Section flush>
        {jobs.length === 0 ? <Empty>No job orders.</Empty> : (
          <RowNav><TableWrap>
            <table className="grid-table">
              <thead><tr><th>Reference</th><th>Position</th><th>Employer / partner</th><th>Country</th><th>Status</th><th className="r">Leads</th><th className="r">Enrolled</th><th className="r">In process</th><th className="w-[140px]">Deployed / vacancies</th><th>Deadline</th></tr></thead>
              <tbody>
                {jobs.map((j) => {
                  const dep = count(j.id, ["DEPLOYED"]);
                  return (
                    <tr key={j.id}>
                      <td className="num"><Link className="row-link" href={`/jobs/${j.id}`}>{j.reference}</Link></td>
                      <td className="font-medium">{j.position}</td>
                      <td className="text-[13px]">{j.employer}<div className="text-[12px] text-muted">{j.partner?.name ?? "Direct"}</div></td>
                      <td className="text-[13px]">{j.country}{j.city && <div className="text-[12px] text-muted">{j.city}</div>}</td>
                      <td><JobStatusTag status={j.status} /></td>
                      <td className="r num">{count(j.id, ["LEAD", "CONTACTED", "INTERESTED"])}</td>
                      <td className="r num">{count(j.id, ["ENROLLED"])}</td>
                      <td className="r num">{count(j.id, ["IN_PROCESS"])}</td>
                      <td><div className="flex items-center gap-2"><div className="flex-1"><Bar value={dep} max={j.vacancies} tone="green" /></div><span className="num text-[12px]">{dep}/{j.vacancies}</span></div></td>
                      <td className="whitespace-nowrap text-[13px]">{d(j.deadline, "d MMM")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap></RowNav>
        )}
      </Section>
    </>
  );
}
