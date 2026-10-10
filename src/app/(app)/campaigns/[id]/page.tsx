import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PLATFORM_LABEL } from "@/lib/constants";
import { d, money } from "@/lib/format";
import { Disclose, Empty, Figure, Figures, LinkButton, Money, PageHeader, Section, TableWrap } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { StatusTag, StageTag } from "@/components/tags";
import { campaignReport } from "../report";
import { CampaignForm } from "../campaign-form";
import { deleteCampaign, saveCampaign } from "../actions";

export const metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("campaigns.view");
  const { id } = await params;
  const [rep] = await campaignReport({ id });
  if (!rep) notFound();
  const { c } = rep;
  const [leads, jobs] = await Promise.all([
    db.candidate.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" }, include: { payments: { select: { amount: true } }, assignedTo: { select: { name: true } } } }),
    db.jobOrder.findMany({ orderBy: { receivedOn: "desc" } }),
  ]);
  return (
    <>
      <PageHeader
        back={{ href: "/campaigns", label: "Campaigns" }}
        title={c.name}
        meta={<><span>{PLATFORM_LABEL[c.platform as keyof typeof PLATFORM_LABEL]}</span><span>{d(c.startDate)} – {c.endDate ? d(c.endDate) : "running"}</span>{c.jobOrder && <Link className="link" href={`/jobs/${c.jobOrder.id}`}>{c.jobOrder.reference}</Link>}</>}
        actions={can(user.role, "candidate.edit") && <LinkButton href={`/candidates/new?campaign=${c.id}${c.jobOrderId ? `&job=${c.jobOrderId}` : ""}`}>Add lead from this campaign</LinkButton>}
      />
      <Figures cols={6}>
        <Figure label="Leads" value={rep.leads} />
        <Figure label="Enrolled" value={rep.enrolled} sub="paid first installment" />
        <Figure label="Deployed" value={rep.deployed} tone="green" />
        <Figure label="Spent" value={money(c.amountSpent, { cur: false })} />
        <Figure label="Cost / enrolment" value={rep.cpe !== null ? money(rep.cpe, { cur: false }) : "—"} tone={rep.cpe === null ? "amber" : undefined} />
        <Figure label="Collected" value={money(rep.collected, { cur: false })} sub={rep.roi !== null ? `${rep.roi.toFixed(1)}× the spend` : undefined} tone="green" />
      </Figures>
      <Section title="Leads from this campaign" className="mt-5" flush>
        {leads.length === 0 ? <Empty>No leads recorded yet.</Empty> : (
          <TableWrap>
            <table className="grid-table">
              <thead><tr><th>Candidate</th><th>Added</th><th>Status</th><th>Stage</th><th>Staff</th><th className="r">Paid</th></tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td><Link className="row-link" href={`/candidates/${l.id}`}>{l.fullName}</Link></td>
                    <td className="text-[13px]">{d(l.createdAt)}</td>
                    <td><StatusTag status={l.status} /></td>
                    <td><StageTag stage={l.stage} /></td>
                    <td className="text-[13px]">{l.assignedTo?.name ?? "—"}</td>
                    <td className="r"><Money v={l.payments.reduce((s, p) => s + p.amount, 0)} zero="—" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>
      {can(user.role, "campaigns.manage") && (
        <div className="mt-5 max-w-[900px] space-y-3">
          <Disclose label="Edit campaign">
            <div className="pt-2"><CampaignForm action={saveCampaign.bind(null, c.id)} c={c} jobs={jobs.map((j) => ({ value: j.id, label: `${j.reference} · ${j.position}` }))} /></div>
          </Disclose>
          {leads.length === 0 && <ActionButton action={deleteCampaign.bind(null, c.id)} variant="danger" confirm="Delete this campaign?">Delete campaign</ActionButton>}
        </div>
      )}
    </>
  );
}
