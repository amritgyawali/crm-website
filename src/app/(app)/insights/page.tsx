import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { AGING_BUCKETS, FUNNEL_STEPS, collectionForecast, funnel, monthlyIntake, receivablesAging } from "@/lib/insights";
import { money, pct } from "@/lib/format";
import { Bar, Empty, Figure, Figures, Money, PageHeader, Section, TableWrap, cx } from "@/components/ui";
import { MonthBars } from "@/components/month-bars";

export const metadata = { title: "Insights" };

const PERIODS = [30, 90, 180, 365];
const mins = (m: number | null) => (m === null ? "—" : m < 60 ? `${Math.round(m)} min` : m < 60 * 48 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} days`);

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requirePage("reports.view");
  const days = PERIODS.includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 90;
  const [f, aging, forecast, intake] = await Promise.all([funnel(days), receivablesAging(), collectionForecast(8), monthlyIntake(6)]);
  const leads = f.overall[0] || 1;
  const overdueTotal = aging.totals.slice(1).reduce((s, x) => s + x, 0);
  const fcMax = Math.max(1, ...forecast.weeks.map((w) => w.amount));
  const agingMax = Math.max(1, ...aging.totals);

  const FunnelTable = ({ title, rows }: { title: string; rows: { key: string; steps: number[]; collected: number }[] }) => (
    <Section title={title} flush>
      <TableWrap>
        <table className="grid-table">
          <thead>
            <tr><th></th>{FUNNEL_STEPS.map((s) => <th key={s} className="r">{s}</th>)}<th className="r">Lead → paid</th><th className="r">Collected</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="font-medium whitespace-nowrap">{r.key}</td>
                {r.steps.map((n, i) => <td key={i} className={cx("r num", !n && "text-rule-2")}>{n}</td>)}
                <td className={cx("r num font-medium", pct(r.steps[3]!, r.steps[0]!) >= 20 ? "text-accent" : pct(r.steps[3]!, r.steps[0]!) < 8 ? "text-warn" : "")}>{pct(r.steps[3]!, r.steps[0]!)}%</td>
                <td className="r"><Money v={r.collected} zero="—" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Section>
  );

  return (
    <>
      <PageHeader
        title="Insights"
        meta="How leads turn into paying, travelling candidates, and where money is stuck."
        actions={
          <div className="flex border border-rule-2 rounded-[3px] overflow-hidden text-[13px]">
            {PERIODS.map((p) => (
              <Link key={p} href={`/insights?days=${p}`} className={cx("px-3 h-[34px] inline-flex items-center no-underline border-r border-rule-2 last:border-r-0", p === days ? "bg-ink text-paper" : "bg-white hover:bg-well")}>
                {p === 365 ? "1 year" : `${p} days`}
              </Link>
            ))}
          </div>
        }
      />

      <Figures cols={4}>
        <Figure label={`Leads, last ${days} days`} value={f.overall[0]} />
        <Figure label="Lead → enrolled & paid" value={`${pct(f.overall[3]!, leads)}%`} sub={`${f.overall[3]} candidates`} tone="green" />
        <Figure label="First call after (median)" value={mins(f.responseAll)} sub={`${f.neverCalled} open leads never called`} tone={f.neverCalled ? "amber" : undefined} />
        <Figure label="Overdue fees" value={money(overdueTotal, { cur: false, whole: true })} sub={`${money(aging.totals[4]!, { whole: true })} over 90 days`} tone={overdueTotal ? "red" : undefined} />
      </Figures>

      <div className="grid gap-5 mt-5 xl:grid-cols-2">
        <Section title="Conversion funnel" note={`candidates added in the last ${days} days`}>
          <ol className="space-y-2.5">
            {FUNNEL_STEPS.map((s, i) => {
              const n = f.overall[i]!;
              const prev = i ? f.overall[i - 1]! : n;
              return (
                <li key={s} className="grid grid-cols-[130px_1fr_92px] items-center gap-3 text-[13px]">
                  <span>{s}</span>
                  <Bar value={n} max={leads} tone={i === 3 ? "green" : "ink"} />
                  <span className="num text-right">{n} <span className="text-muted text-[11.5px]">{i ? `${pct(n, prev)}%` : ""}</span></span>
                </li>
              );
            })}
          </ol>
          <p className="text-[12px] text-muted mt-3">The small percentage is how many moved on from the step above.</p>
        </Section>

        <Section title="New leads and enrolments" note="per month">
          <MonthBars data={intake} aLabel="New leads" bLabel="Enrolled" showNet={false} height={160} />
        </Section>
      </div>

      <div className="grid gap-5 mt-5">
        <FunnelTable title="By lead source" rows={f.bySource} />
        <FunnelTable title="By staff member" rows={f.byStaff} />
      </div>

      <div className="grid gap-5 mt-5 xl:grid-cols-2">
        <Section title="Fees owed by age" note="open cases">
          <ul className="space-y-2.5">
            {AGING_BUCKETS.map((b, i) => (
              <li key={b} className="grid grid-cols-[110px_1fr_110px] items-center gap-3 text-[13px]">
                <span className={cx(i >= 3 && "text-danger")}>{b}</span>
                <Bar value={aging.totals[i]!} max={agingMax} tone={i === 0 ? "green" : i >= 3 ? "red" : "amber"} />
                <Money v={aging.totals[i]!} className="text-right" zero="—" />
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-muted mt-3">Plus {money(aging.waitingOnStage, { whole: true })} in installments that fall due when a visa stage is reached.</p>
        </Section>

        <Section title="Expected collections" note="scheduled installments, next 8 weeks">
          <ul className="space-y-2">
            {forecast.weeks.map((w) => (
              <li key={w.label} className="grid grid-cols-[110px_1fr_110px] items-center gap-3 text-[13px]">
                <span>Week of {w.label}</span>
                <Bar value={w.amount} max={fcMax} tone="green" />
                <span className="text-right"><Money v={w.amount} zero="—" /> <span className="text-muted text-[11.5px]">{w.count || ""}</span></span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-muted mt-3">{money(forecast.overdueNow, { whole: true })} is already overdue and not counted in these weeks.</p>
        </Section>
      </div>

      <div className="grid gap-5 mt-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Section title="Overdue by staff member" flush>
          <TableWrap>
            <table className="grid-table">
              <thead><tr><th>Staff</th>{AGING_BUCKETS.map((b) => <th key={b} className="r">{b}</th>)}</tr></thead>
              <tbody>
                {aging.byStaff.map((r) => (
                  <tr key={r.staff}>
                    <td className="font-medium whitespace-nowrap">{r.staff}</td>
                    {r.v.map((x, i) => <td key={i} className={cx("r", i >= 3 && x > 0 && "text-danger")}><Money v={x} zero="—" /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <div className="border-t border-rule">
            <div className="px-4 pt-3 pb-1 text-[13px] font-semibold">Largest overdue balances</div>
            {aging.debtors.length === 0 ? <Empty>No one is overdue.</Empty> : (
              <TableWrap>
                <table className="grid-table">
                  <thead><tr><th>Candidate</th><th>Staff</th><th className="r">Oldest</th><th className="r">Overdue</th><th className="r">Total balance</th></tr></thead>
                  <tbody>
                    {aging.debtors.map((x) => (
                      <tr key={x.id}>
                        <td><Link className="row-link" href={`/candidates/${x.id}`}>{x.name}</Link> <span className="num text-[12px] text-muted">{x.code}</span></td>
                        <td className="text-[13px]">{x.staff}</td>
                        <td className={cx("r num", x.oldestDays > 60 && "text-danger")}>{x.oldestDays}d</td>
                        <td className="r font-medium"><Money v={x.overdue} /></td>
                        <td className="r text-muted"><Money v={x.balance} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>
        </Section>

        <Section title="Speed to first call" note="median, by staff">
          {f.response.length === 0 ? <p className="text-[13px] text-muted">No calls yet.</p> : (
            <ul className="space-y-2 text-[13px]">
              {f.response.map((r) => (
                <li key={r.staff} className="flex justify-between gap-3"><span>{r.staff}</span><span className="num">{mins(r.median)} <span className="text-muted text-[11.5px]">({r.n})</span></span></li>
              ))}
            </ul>
          )}
          <p className="text-[12px] text-muted mt-3">Counted from when the lead was added to the first logged call or WhatsApp. Number of leads in brackets.</p>
        </Section>
      </div>
    </>
  );
}
