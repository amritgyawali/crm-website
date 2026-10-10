import Link from "next/link";
import { subMonths, startOfWeek } from "date-fns";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ranges, monthKey } from "@/lib/dates";
import { getAlerts } from "@/lib/alerts";
import { getDueInstallments } from "@/lib/dues";
import { lastMonths } from "@/lib/summary";
import { STAGES, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { d, money, pct, relDays } from "@/lib/format";
import { Bar, Empty, Figure, Figures, Money, Notice, PageHeader, Section, TableWrap, cx } from "@/components/ui";
import { MonthBars } from "@/components/month-bars";
import { campaignReport } from "./campaigns/report";
import { partnerTotals } from "./partners/data";
import { performance } from "./staff/perf";

export const metadata = { title: "Today" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const r = ranges();
  const boss = can(user.role, "reports.view");
  const scope = boss ? {} : { candidate: { assignedToId: user.id } };

  const [alerts, payToday, payMonth, payLastMonth, newLeads, inProcess, deployedMonth, stageCounts, recentPays] = await Promise.all([
    getAlerts(user),
    db.payment.groupBy({ by: ["method"], where: { date: { gte: r.todayStart, lte: r.todayEnd }, ...scope }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { date: { gte: r.monthStart, lte: r.todayEnd }, ...scope }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { date: { gte: subMonths(r.monthStart, 1), lte: subMonths(r.now, 1) }, ...scope }, _sum: { amount: true } }),
    db.candidate.count({ where: { createdAt: { gte: startOfWeek(r.now, { weekStartsOn: 1 }) }, ...(boss ? {} : { assignedToId: user.id }) } }),
    db.candidate.count({ where: { status: "IN_PROCESS", ...(boss ? {} : { assignedToId: user.id }) } }),
    db.stageEvent.count({ where: { stage: "ARRIVED", result: "DONE", date: { gte: r.monthStart }, ...(boss ? {} : { candidate: { assignedToId: user.id } }) } }),
    db.candidate.groupBy({ by: ["stage"], where: { status: { in: ["IN_PROCESS", "DEPLOYED"] }, stage: { not: null } }, _count: true }),
    db.payment.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 8, include: { candidate: { select: { id: true, fullName: true } }, receivedBy: { select: { name: true } } } }),
  ]);
  const overdueList = await getDueInstallments({ until: r.todayStart, assignedToId: boss ? undefined : user.id });
  const overdue = overdueList.reduce((s, x) => s + x.outstanding, 0);
  const todayTotal = payToday.reduce((s, p) => s + (p._sum.amount ?? 0), 0);
  const cash = payToday.find((p) => p.method === "CASH")?._sum.amount ?? 0;
  const month = payMonth._sum.amount ?? 0;
  const last = payLastMonth._sum.amount ?? 0;
  const g = (k: string) => alerts.find((a) => a.key === k)?.items ?? [];

  const todo = [
    { label: "Payments overdue", n: g("payments").filter((i) => i.tone === "danger").length, href: "/finance", red: true },
    { label: "Payments due soon", n: g("payments").filter((i) => i.tone !== "danger").length, href: "/finance" },
    { label: "Call-backs due", n: g("callbacks").length, href: "/calls" },
    { label: "Leads not contacted", n: g("uncontacted").length, href: "/alerts", red: true },
    { label: "Visa files over time", n: g("stuck").length, href: "/visa" },
    { label: "Post-arrival check-ins", n: g("checkins").length, href: "/alerts" },
    { label: "Passport problems", n: g("passports").length, href: "/alerts" },
    { label: "Partner agreements / follow-ups", n: g("partners").length, href: "/alerts" },
    { label: "Office bills due", n: g("bills").length, href: "/expenses" },
    { label: "Waiting for approval", n: g("approvals").length, href: "/alerts" },
  ];
  const shownTodo = todo.filter((t) => t.n > 0);

  const stageMax = Math.max(1, ...stageCounts.map((s) => s._count));

  // management-only blocks
  const [months, camps, partners, staffPerf] = boss
    ? await Promise.all([
        lastMonths(6),
        campaignReport(),
        partnerTotals(),
        db.user
          .findMany({ where: { active: true, role: "SALES" }, orderBy: { name: "asc" } })
          .then((st) => Promise.all(st.map(async (u) => ({ u, calls: await db.callLog.count({ where: { userId: u.id, createdAt: { gte: r.todayStart } } }) })))),
      ])
    : [null, null, null, null];
  const target = boss ? null : await db.target.findUnique({ where: { userId_month: { userId: user.id, month: monthKey() } } });
  const myPerf = !boss ? (await performance([user.id], r.now)).get(user.id)! : null;

  return (
    <>
      <PageHeader title={d(r.now, "EEEE, d MMMM")} meta={<span>Signed in as {user.name}</span>} />
      {sp.denied && <div className="mb-4"><Notice tone="red">Your role does not have access to that page.</Notice></div>}

      <Figures cols={6}>
        <Figure label="Collected today" value={money(todayTotal, { cur: false })} sub={`cash ${money(cash, { cur: false, whole: true })} · bank ${money(todayTotal - cash, { cur: false, whole: true })}`} tone="green" href={can(user.role, "finance.view") ? "/finance/collections" : undefined} />
        <Figure label={d(r.now, "MMMM")} value={money(month, { cur: false, whole: true })} sub={last ? `${month >= last ? "+" : ""}${pct(month - last, last)}% vs same day last month` : "collected"} />
        <Figure label="Overdue fees" value={money(overdue, { cur: false, whole: true })} sub={`${overdueList.length} installments`} tone={overdue ? "red" : undefined} href="/finance" />
        <Figure label="New leads" value={newLeads} sub="this week" href="/candidates?status=LEAD" />
        <Figure label="In visa process" value={inProcess} href="/visa" />
        <Figure label="Arrived" value={deployedMonth} sub="this month" tone="green" />
      </Figures>

      <div className="grid gap-5 mt-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5 min-w-0">
          <Section title="Needs doing" note="from reminders" flush actions={<Link className="link text-[12.5px]" href="/alerts">All reminders</Link>}>
            {shownTodo.length === 0 ? <Empty>Nothing pending. Good day to call new leads.</Empty> : (
              <ul className="grid sm:grid-cols-2">
                {shownTodo.map((t, i) => (
                  <li key={t.label} className={cx("border-rule", i % 2 === 0 && "sm:border-r", "border-b")}>
                    <Link href={t.href} className="flex items-center justify-between gap-3 px-4 py-3 no-underline hover:bg-well/50">
                      <span className="text-[13.5px]">{t.label}</span>
                      <span className={cx("num text-[18px]", t.red ? "text-danger" : "text-ink")}>{t.n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {months && (
            <Section title="Income and costs" note="last six months, cash basis" actions={<Link className="link text-[12.5px]" href="/expenses/report">Monthly report</Link>}>
              <MonthBars data={months.map((m) => ({ label: m.label.split(" ")[0]!, a: m.income, b: m.costs }))} aLabel="Income" bLabel="Costs" />
            </Section>
          )}

          <Section title="Visa & deployment pipeline" actions={<Link className="link text-[12.5px]" href="/visa">Open</Link>}>
            <ul className="space-y-2">
              {STAGES.map((st, i) => {
                const n = stageCounts.find((s) => s.stage === st.value)?._count ?? 0;
                return (
                  <li key={st.value} className="grid grid-cols-[170px_1fr_32px] items-center gap-3 text-[13px]">
                    <span className="truncate"><span className="num text-muted mr-1.5">{i + 1}</span>{st.short}</span>
                    <Bar value={n} max={stageMax} />
                    <span className="num text-right">{n}</span>
                  </li>
                );
              })}
            </ul>
          </Section>

          {camps && (
            <Section title="Campaigns" note="cost per enrolled, paying candidate" flush actions={<Link className="link text-[12.5px]" href="/campaigns">All campaigns</Link>}>
              <TableWrap>
                <table className="grid-table">
                  <thead><tr><th>Campaign</th><th className="r">Leads</th><th className="r">Enrolled</th><th className="r">Spent</th><th className="r">Per enrolment</th><th className="r">Collected</th></tr></thead>
                  <tbody>
                    {camps.slice(0, 5).map((c) => (
                      <tr key={c.c.id}>
                        <td><Link className="row-link" href={`/campaigns/${c.c.id}`}>{c.c.name}</Link></td>
                        <td className="r num">{c.leads}</td>
                        <td className="r num">{c.enrolled}</td>
                        <td className="r"><Money v={c.c.amountSpent} /></td>
                        <td className="r font-medium">{c.cpe !== null ? <Money v={c.cpe} /> : "—"}</td>
                        <td className="r"><Money v={c.collected} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Section>
          )}
        </div>

        <div className="space-y-5">
          {myPerf && (
            <Section title="My month" actions={<Link className="link text-[12.5px]" href="/staff">Targets</Link>}>
              <div className="space-y-3 text-[12.5px]">
                {[
                  ["Calls", myPerf.calls, target?.calls ?? 0],
                  ["Enrolments", myPerf.enrolments, target?.enrolments ?? 0],
                  ["Collected", Math.round(myPerf.collection), target?.collection ?? 0],
                ].map(([l, v, t]) => (
                  <div key={l as string}>
                    <div className="flex justify-between mb-1"><span className="text-muted">{l}</span><span className="num">{(v as number).toLocaleString()}{t ? ` / ${(t as number).toLocaleString()}` : ""}</span></div>
                    <Bar value={v as number} max={(t as number) || Math.max(v as number, 1)} tone={t && (v as number) >= (t as number) ? "green" : "ink"} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {staffPerf && (
            <Section title="Sales calls today" flush actions={<Link className="link text-[12.5px]" href="/calls/stats">Counts</Link>}>
              <ul className="divide-y divide-rule">
                {staffPerf.map(({ u, calls }) => (
                  <li key={u.id} className="px-4 py-2.5 flex items-center justify-between text-[13px]">
                    <Link className="row-link" href={`/calls?staff=${u.id}`}>{u.name}</Link>
                    <span className="num">{calls}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {partners && (
            <Section title="Partners by deployments" flush actions={<Link className="link text-[12.5px]" href="/partners">All</Link>}>
              <ul className="divide-y divide-rule">
                {[...partners].sort((a, b) => b.deployed - a.deployed || b.income - a.income).slice(0, 5).map((p) => (
                  <li key={p.p.id} className="px-4 py-2.5 text-[13px] flex justify-between gap-3">
                    <span className="min-w-0"><Link className="row-link" href={`/partners/${p.p.id}`}>{p.p.name}</Link><div className="text-[12px] text-muted">{money(p.income, { whole: true })} income</div></span>
                    <span className="num">{p.deployed}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Latest payments" flush>
            {recentPays.length === 0 ? <Empty>None yet.</Empty> : (
              <ul className="divide-y divide-rule">
                {recentPays.map((p) => (
                  <li key={p.id} className="px-4 py-2.5 text-[13px] flex justify-between gap-3">
                    <span className="min-w-0">
                      <Link className="row-link" href={`/candidates/${p.candidate.id}`}>{p.candidate.fullName}</Link>
                      <div className="text-[12px] text-muted">{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL]} · {p.receivedBy.name} · {relDays(p.date)}</div>
                    </span>
                    <Money v={p.amount} className="font-medium" />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
