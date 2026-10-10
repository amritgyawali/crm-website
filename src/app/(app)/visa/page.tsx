import Link from "next/link";
import { addMonths, differenceInCalendarDays } from "date-fns";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings, getStageDays, num } from "@/lib/settings";
import { ranges } from "@/lib/dates";
import { STAGES, STAGE_LABEL, STAGE_SHORT, type Stage } from "@/lib/constants";
import { d, relDays } from "@/lib/format";
import { Bar, Empty, Figure, Figures, PageHeader, Section, TableWrap, cx } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";

export const metadata = { title: "Visa & deployment" };

export default async function VisaPage({ searchParams }: { searchParams: Promise<{ country?: string; job?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const [stageDays, s] = await Promise.all([getStageDays(), getSettings()]);
  const r = ranges();

  const cands = await db.candidate.findMany({
    where: {
      stage: { not: null },
      status: { in: ["IN_PROCESS", "DEPLOYED"] },
      ...(sp.job ? { jobOrderId: sp.job } : {}),
      ...(sp.country ? { jobOrder: { country: sp.country } } : {}),
    },
    select: {
      id: true, fullName: true, stage: true, stageEnteredAt: true, passportExpiry: true, status: true,
      jobOrder: { select: { id: true, reference: true, position: true, country: true, contractMonths: true } },
      assignedTo: { select: { name: true } },
    },
  });
  const [jobsAll, recent, refusedThisMonth, arrivedThisMonth] = await Promise.all([
    db.jobOrder.findMany({ select: { id: true, reference: true, position: true, country: true }, orderBy: { reference: "asc" } }),
    db.stageEvent.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 12, include: { candidate: { select: { id: true, fullName: true } }, user: { select: { name: true } } } }),
    db.stageEvent.count({ where: { result: "REFUSED", date: { gte: r.monthStart } } }),
    db.stageEvent.count({ where: { stage: "ARRIVED", result: "DONE", date: { gte: r.monthStart } } }),
  ]);
  const countries = [...new Set(jobsAll.map((j) => j.country))].sort();

  const days = (c: (typeof cands)[number]) => (c.stageEnteredAt ? differenceInCalendarDays(r.now, c.stageEnteredAt) : 0);
  const isStuck = (c: (typeof cands)[number]) => c.stage !== "ARRIVED" && c.stage !== "POST_ARRIVAL" && days(c) > stageDays[c.stage as Stage];
  const byStage = STAGES.map((st) => {
    const list = cands.filter((c) => c.stage === st.value);
    return { ...st, list, stuck: list.filter(isStuck).length, avg: list.length ? Math.round(list.reduce((x, c) => x + days(c), 0) / list.length) : 0 };
  });
  const max = Math.max(1, ...byStage.map((b) => b.list.length));
  const stuck = cands.filter(isStuck).sort((a, b) => days(b) - days(a));
  const months = num(s.passportAlertMonths, 12);
  const passports = cands.filter((c) => c.status === "IN_PROCESS" && c.passportExpiry && (c.passportExpiry < addMonths(r.now, months) || c.passportExpiry < addMonths(r.now, c.jobOrder?.contractMonths ?? 0)));

  const matrix = (keyOf: (c: (typeof cands)[number]) => string | null, label: (k: string) => React.ReactNode) => {
    const keys = [...new Set(cands.map(keyOf).filter(Boolean) as string[])].sort();
    return (
      <TableWrap>
        <table className="grid-table">
          <thead>
            <tr><th></th>{STAGES.map((st, i) => <th key={st.value} className="r !px-2" title={st.label}>{i + 1}</th>)}<th className="r">Total</th></tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const list = cands.filter((c) => keyOf(c) === k);
              return (
                <tr key={k}>
                  <td className="whitespace-nowrap">{label(k)}</td>
                  {STAGES.map((st) => {
                    const n = list.filter((c) => c.stage === st.value).length;
                    const st2 = list.filter((c) => c.stage === st.value && isStuck(c)).length;
                    return <td key={st.value} className={cx("r num", !n && "text-rule-2", st2 > 0 && "text-warn font-medium")}>{n || "·"}</td>;
                  })}
                  <td className="r num font-medium">{list.length}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><td>All</td>{STAGES.map((st) => <td key={st.value} className="r num">{cands.filter((c) => c.stage === st.value).length}</td>)}<td className="r num">{cands.length}</td></tr>
          </tfoot>
        </table>
        <p className="px-4 py-2 text-[11.5px] text-muted border-t border-rule">{STAGES.map((st, i) => `${i + 1} ${st.short}`).join(" · ")}</p>
      </TableWrap>
    );
  };
  const jobLabel = new Map(jobsAll.map((j) => [j.id, j]));

  return (
    <>
      <PageHeader title="Visa & deployment" meta="From employer selection to post-arrival check-in. Amber counts have someone over the stage time limit." />
      <FilterForm>
        <select name="country" defaultValue={sp.country ?? ""} className="control !w-[180px]"><option value="">All countries</option>{countries.map((c) => <option key={c}>{c}</option>)}</select>
        <select name="job" defaultValue={sp.job ?? ""} className="control !w-[260px]"><option value="">All job orders</option>{jobsAll.map((j) => <option key={j.id} value={j.id}>{j.reference} · {j.position}</option>)}</select>
      </FilterForm>
      <Figures cols={5}>
        <Figure label="In process" value={cands.filter((c) => c.status === "IN_PROCESS").length} sub="selected, not yet travelled" />
        <Figure label="Arrived this month" value={arrivedThisMonth} tone="green" />
        <Figure label="Over time limit" value={stuck.length} tone={stuck.length ? "amber" : undefined} sub="need a push" />
        <Figure label="Refused this month" value={refusedThisMonth} tone={refusedThisMonth ? "red" : undefined} sub="WP or visa" />
        <Figure label="Passport issues" value={passports.length} tone={passports.length ? "red" : undefined} sub={`expiring within ${months} months or before contract end`} />
      </Figures>

      <div className="grid gap-5 mt-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5 min-w-0">
          <Section title="Candidates at each stage" flush>
            <table className="grid-table">
              <thead><tr><th>Stage</th><th className="w-[40%]"></th><th className="r">People</th><th className="r">Avg days</th><th className="r">Limit</th><th className="r">Over</th></tr></thead>
              <tbody>
                {byStage.map((b, i) => (
                  <tr key={b.value}>
                    <td className="whitespace-nowrap"><span className="num text-muted mr-2">{i + 1}</span>{b.label}</td>
                    <td className="align-middle"><Bar value={b.list.length} max={max} tone={b.stuck ? "amber" : "ink"} /></td>
                    <td className="r num font-medium">{b.list.length}</td>
                    <td className="r num">{b.list.length ? b.avg : "—"}</td>
                    <td className="r num text-muted">{stageDays[b.value] >= 9999 ? "—" : stageDays[b.value]}</td>
                    <td className={cx("r num", b.stuck > 0 && "text-warn font-medium")}>{b.stuck || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title="By job order" flush>{cands.length ? matrix((c) => c.jobOrder?.id ?? null, (k) => { const j = jobLabel.get(k); return j ? <Link className="row-link" href={`/jobs/${k}`}>{j.reference}<span className="text-muted font-normal"> · {j.position}</span></Link> : k; }) : <Empty>No one in process.</Empty>}</Section>
          <Section title="By country" flush>{cands.length ? matrix((c) => c.jobOrder?.country ?? null, (k) => k) : <Empty>No one in process.</Empty>}</Section>
        </div>

        <div className="space-y-5">
          <Section title="Over the time limit" flush>
            {stuck.length === 0 ? <Empty>Everyone is moving on time.</Empty> : (
              <ul className="divide-y divide-rule">
                {stuck.map((c) => (
                  <li key={c.id} className="px-4 py-2.5 text-[13px]">
                    <div className="flex justify-between gap-2"><Link className="row-link" href={`/candidates/${c.id}`}>{c.fullName}</Link><span className="num text-warn">{days(c)}d / {stageDays[c.stage as Stage]}</span></div>
                    <div className="text-muted">{STAGE_SHORT[c.stage as Stage]} · {c.jobOrder?.country}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          {passports.length > 0 && (
            <Section title="Passport expiry" flush>
              <ul className="divide-y divide-rule">
                {passports.map((c) => (
                  <li key={c.id} className="px-4 py-2.5 text-[13px] flex justify-between gap-2">
                    <Link className="row-link" href={`/candidates/${c.id}`}>{c.fullName}</Link>
                    <span className={cx("num", c.passportExpiry! < addMonths(r.now, 6) ? "text-danger" : "text-warn")}>{d(c.passportExpiry, "MMM yyyy")}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Latest updates" flush>
            <ul className="divide-y divide-rule">
              {recent.map((e) => (
                <li key={e.id} className="px-4 py-2.5 text-[13px]">
                  <Link className="row-link" href={`/candidates/${e.candidate.id}`}>{e.candidate.fullName}</Link>
                  <div className={cx(e.result === "REFUSED" ? "text-danger" : "text-ink-2")}>{e.result === "REFUSED" ? STAGE_LABEL[e.stage as Stage].replace("approved", "refused") : STAGE_LABEL[e.stage as Stage]}</div>
                  <div className="text-muted text-[12px]">{e.user.name} · {relDays(e.date)}</div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
