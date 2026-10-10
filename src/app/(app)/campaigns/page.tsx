import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PLATFORM_LABEL, LEAD_SOURCE_LABEL } from "@/lib/constants";
import { d } from "@/lib/format";
import { Disclose, Empty, Money, PageHeader, Section, TableWrap, Tag, btn } from "@/components/ui";
import { campaignReport } from "./report";
import { CampaignForm } from "./campaign-form";
import { saveCampaign } from "./actions";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const user = await requirePage("campaigns.view");
  const [rows, jobs, sources] = await Promise.all([
    campaignReport(),
    db.jobOrder.findMany({ where: { status: { in: ["OPEN", "ON_HOLD"] } }, orderBy: { receivedOn: "desc" } }),
    db.candidate.groupBy({ by: ["leadSource"], _count: true }),
  ]);
  const now = new Date();
  const t = rows.reduce((a, r) => ({ leads: a.leads + r.leads, enrolled: a.enrolled + r.enrolled, deployed: a.deployed + r.deployed, spent: a.spent + r.c.amountSpent, collected: a.collected + r.collected }), { leads: 0, enrolled: 0, deployed: 0, spent: 0, collected: 0 });
  const totalLeads = sources.reduce((s, x) => s + x._count, 0);

  return (
    <>
      <PageHeader
        title="Campaigns"
        meta="Which boosted posts bring candidates who enrol and pay, not just messages."
        actions={can(user.role, "reports.view") && <a className={btn("secondary")} href="/api/export/campaigns">Export</a>}
      />
      <Section flush>
        {rows.length === 0 ? <Empty>No campaigns recorded.</Empty> : (
          <TableWrap>
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Campaign</th><th>Platform</th><th>Dates</th>
                  <th className="r">Leads</th><th className="r">Enrolled</th><th className="r">Deployed</th>
                  <th className="r">Spent</th><th className="r">Cost / lead</th><th className="r">Cost / enrolment</th><th className="r">Collected</th><th className="r">Return</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.c.id}>
                    <td><Link className="row-link" href={`/campaigns/${r.c.id}`}>{r.c.name}</Link>{r.c.jobOrder && <div className="text-[12px] text-muted">{r.c.jobOrder.position}, {r.c.jobOrder.country}</div>}</td>
                    <td className="text-[13px]">{PLATFORM_LABEL[r.c.platform as keyof typeof PLATFORM_LABEL]}</td>
                    <td className="text-[13px] whitespace-nowrap">{d(r.c.startDate, "d MMM")} – {r.c.endDate ? d(r.c.endDate, "d MMM") : <Tag tone="green">running</Tag>}{r.c.endDate && r.c.endDate > now && <Tag tone="green" className="ml-1">running</Tag>}</td>
                    <td className="r num">{r.leads}</td>
                    <td className="r num">{r.enrolled}<span className="text-muted text-[12px]">{r.leads ? ` ${Math.round((r.enrolled / r.leads) * 100)}%` : ""}</span></td>
                    <td className="r num">{r.deployed}</td>
                    <td className="r"><Money v={r.c.amountSpent} /></td>
                    <td className="r"><Money v={r.cpl ?? 0} zero="—" /></td>
                    <td className="r font-medium">{r.cpe !== null ? <Money v={r.cpe} /> : <span className="text-muted">no enrolments</span>}</td>
                    <td className="r"><Money v={r.collected} zero="—" /></td>
                    <td className="r num">{r.roi !== null ? `${r.roi.toFixed(1)}×` : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>All campaigns</td>
                  <td className="r num">{t.leads}</td><td className="r num">{t.enrolled}</td><td className="r num">{t.deployed}</td>
                  <td className="r"><Money v={t.spent} /></td><td className="r"><Money v={t.leads ? t.spent / t.leads : 0} /></td>
                  <td className="r"><Money v={t.enrolled ? t.spent / t.enrolled : 0} /></td><td className="r"><Money v={t.collected} /></td>
                  <td className="r num">{t.spent ? `${(t.collected / t.spent).toFixed(1)}×` : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
        )}
        <p className="px-4 py-2 text-[12px] text-muted border-t border-rule">Enrolled = leads who enrolled and paid the first installment. Collected = all candidate payments from this campaign&apos;s leads. Return = collected ÷ spent.</p>
      </Section>

      <div className="grid gap-5 mt-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {can(user.role, "campaigns.manage") ? (
          <Section title="Add a campaign">
            <CampaignForm action={saveCampaign.bind(null, null)} jobs={jobs.map((j) => ({ value: j.id, label: `${j.reference} · ${j.position}, ${j.country}` }))} />
          </Section>
        ) : <div />}
        <div className="space-y-5">
          <Section title="All leads by source">
            <ul className="space-y-1.5 text-[13px]">
              {sources.sort((a, b) => b._count - a._count).map((s) => (
                <li key={s.leadSource} className="flex justify-between"><span>{LEAD_SOURCE_LABEL[s.leadSource as keyof typeof LEAD_SOURCE_LABEL]}</span><span className="num">{s._count} <span className="text-muted">{Math.round((s._count / Math.max(totalLeads, 1)) * 100)}%</span></span></li>
              ))}
            </ul>
          </Section>
          <Disclose label="Automatic leads from Facebook / Instagram">
            <div className="text-[12.5px] text-ink-2 space-y-2 pt-2">
              <p>Leads can be sent into the CRM by Zapier, Make or a Meta lead-form webhook. Each one becomes a new candidate with the right campaign attached.</p>
              <p>POST to <code className="num bg-well px-1">/api/leads</code> with header <code className="num bg-well px-1">x-api-key</code> and JSON: <code className="num bg-well px-1">{`{ "name", "phone", "campaignId" or "adId", "nationality" }`}</code>.</p>
              <p>Set the key as <code className="num">LEADS_API_KEY</code> in the server settings. Put the ad or form ID in the campaign&apos;s “Lead form / ad ID” field.</p>
            </div>
          </Disclose>
        </div>
      </div>
    </>
  );
}
