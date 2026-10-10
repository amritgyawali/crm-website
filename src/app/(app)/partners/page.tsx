import Link from "next/link";
import { addDays } from "date-fns";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PARTNER_TYPE_LABEL } from "@/lib/constants";
import { d, money } from "@/lib/format";
import { Bar, Empty, LinkButton, Money, PageHeader, Section, TableWrap, Tag, cx } from "@/components/ui";
import { partnerTotals } from "./data";

export const metadata = { title: "Partners" };

export default async function PartnersPage() {
  const user = await requireUser();
  const fin = can(user.role, "partners.finance");
  const rows = await partnerTotals();
  const now = new Date();
  const byDeploy = [...rows].sort((a, b) => b.deployed - a.deployed).slice(0, 6);
  const byIncome = [...rows].sort((a, b) => b.income - a.income).slice(0, 6);
  const maxDep = Math.max(1, ...byDeploy.map((r) => r.deployed));
  const maxInc = Math.max(1, ...byIncome.map((r) => r.income));

  return (
    <>
      <PageHeader title="Partners" meta="Overseas agencies and employers who send job orders, supply candidates, or both."
        actions={can(user.role, "partners.manage") && <LinkButton href="/partners/new" variant="primary">New partner</LinkButton>} />

      {can(user.role, "reports.view") && (
        <div className="grid gap-5 lg:grid-cols-2 mb-5">
          <Section title="Most deployments">
            <ul className="space-y-2.5">
              {byDeploy.map((r) => (
                <li key={r.p.id} className="grid grid-cols-[1fr_50%_32px] items-center gap-3 text-[13px]">
                  <Link className="row-link truncate" href={`/partners/${r.p.id}`}>{r.p.name}</Link>
                  <Bar value={r.deployed} max={maxDep} />
                  <span className="num text-right">{r.deployed}</span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Most income" note="partner payments + candidate fees, less commission paid">
            <ul className="space-y-2.5">
              {byIncome.map((r) => (
                <li key={r.p.id} className="grid grid-cols-[1fr_40%_90px] items-center gap-3 text-[13px]">
                  <Link className="row-link truncate" href={`/partners/${r.p.id}`}>{r.p.name}</Link>
                  <Bar value={Math.max(r.income, 0)} max={maxInc} tone="green" />
                  <span className="num text-right">{money(r.income, { cur: false, whole: true })}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      <Section flush>
        {rows.length === 0 ? <Empty>No partners yet.</Empty> : (
          <TableWrap>
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Partner</th><th>Type</th><th className="r">Job orders</th><th className="r">Supplied</th><th className="r">Selected</th><th className="r">Deployed</th>
                  {fin && <><th className="r">They owe us</th><th className="r">We owe them</th></>}
                  <th>Agreement</th><th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const exp = r.nextExpiry;
                  return (
                    <tr key={r.p.id}>
                      <td><Link className="row-link" href={`/partners/${r.p.id}`}>{r.p.name}</Link><div className="text-[12px] text-muted">{r.p.country}{r.p.contacts[0] ? ` · ${r.p.contacts[0].name}` : ""}</div></td>
                      <td className="text-[13px]">{PARTNER_TYPE_LABEL[r.p.type as keyof typeof PARTNER_TYPE_LABEL]}{r.p.status !== "ACTIVE" && <div><Tag tone="faint">{r.p.status === "ON_HOLD" ? "on hold" : "ended"}</Tag></div>}</td>
                      <td className="r num">{r.openJobs}<span className="text-muted">/{r.jobs}</span></td>
                      <td className="r num">{r.supplied || "—"}</td>
                      <td className="r num">{r.selected || "—"}</td>
                      <td className="r num font-medium">{r.deployed || "—"}</td>
                      {fin && <><td className="r"><Money v={r.m.theyOweOut} zero="—" /></td><td className="r"><Money v={r.m.weOweOut} zero="—" /></td></>}
                      <td className={cx("whitespace-nowrap text-[13px]", exp && exp < now ? "text-danger font-medium" : exp && exp < addDays(now, 30) ? "text-warn" : "")}>{exp ? (exp < now ? `expired ${d(exp, "d MMM")}` : d(exp, "d MMM yyyy")) : "—"}</td>
                      <td className={cx("whitespace-nowrap text-[13px]", r.p.nextFollowUp && r.p.nextFollowUp < now && "text-danger")}>{d(r.p.nextFollowUp, "d MMM")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}
