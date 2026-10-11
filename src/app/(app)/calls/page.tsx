import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ranges, monthKey } from "@/lib/dates";
import { getDueInstallments } from "@/lib/dues";
import { getSettings, num } from "@/lib/settings";
import { d, money, relDays } from "@/lib/format";
import { subDays } from "date-fns";
import { Bar, Disclose, Empty, LinkButton, PageHeader, Section, Tabs, Tag, cx } from "@/components/ui";
import { ContactButtons, RemindButton } from "@/components/contact";
import { reminderWriter } from "@/lib/reminder";
import { FilterForm } from "@/components/filter-form";
import { OutcomeTag, StatusTag } from "@/components/tags";
import { CallLogger } from "../candidates/[id]/call-logger";
import { logCall } from "../candidates/actions";

export const metadata = { title: "Call list" };

type Row = { remind?: string; id: string; name: string; phone: string; whatsapp: string | null; status?: string; context: React.ReactNode; tone?: "red" | "amber"; lastOutcome?: string | null };

function CallRows({ rows, empty }: { rows: Row[]; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-rule">
      {rows.map((r) => (
        <li key={r.id + String(r.context)} className="px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/candidates/${r.id}`} className="row-link">{r.name}</Link>
                {r.status && <StatusTag status={r.status} />}
                {r.lastOutcome && <span className="text-[12px] text-muted">last: <OutcomeTag outcome={r.lastOutcome} /></span>}
              </div>
              <div className={cx("text-[13px] mt-0.5", r.tone === "red" ? "text-danger" : r.tone === "amber" ? "text-warn" : "text-muted")}>{r.context}</div>
            </div>
            <span className="inline-flex gap-1.5">{r.remind && <RemindButton phone={r.whatsapp || r.phone} text={r.remind} candidateId={r.id} />}<ContactButtons phone={r.phone} whatsapp={r.whatsapp} /></span>
          </div>
          <Disclose label="Log result" className="mt-2">
            <div className="pt-2"><CallLogger action={logCall.bind(null, r.id)} compact /></div>
          </Disclose>
        </li>
      ))}
    </ul>
  );
}

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ staff?: string }> }) {
  const user = await requirePage("call.log");
  const sp = await searchParams;
  const viewAll = can(user.role, "calls.viewAll");
  const staffId = viewAll && sp.staff ? sp.staff : user.id;
  const r = ranges();
  const s = await getSettings();
  const staffList = viewAll ? await db.user.findMany({ where: { active: true, role: { in: ["SALES", "MANAGEMENT", "OPERATIONS"] } }, orderBy: { name: "asc" } }) : [];
  const who = staffId === user.id ? user : await db.user.findUniqueOrThrow({ where: { id: staffId } });

  const lastOutcomeSel = { callLogs: { orderBy: { createdAt: "desc" as const }, take: 1, select: { outcome: true, note: true, createdAt: true } } };
  const [dues, callbacks, newLeads, unassigned, todayCalls, target, monthCalls] = await Promise.all([
    getDueInstallments({ until: r.todayEnd, assignedToId: staffId }),
    db.candidate.findMany({
      where: { assignedToId: staffId, nextCallAt: { lte: r.todayEnd }, status: { notIn: ["WITHDRAWN", "REFUSED", "NOT_ELIGIBLE", "NOT_INTERESTED"] } },
      orderBy: { nextCallAt: "asc" },
      select: { id: true, fullName: true, phone: true, whatsapp: true, status: true, nextCallAt: true, ...lastOutcomeSel },
    }),
    db.candidate.findMany({
      where: { assignedToId: staffId, status: "LEAD", lastContactedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, fullName: true, phone: true, whatsapp: true, status: true, createdAt: true, leadSource: true, campaign: { select: { name: true } }, jobOrder: { select: { position: true, country: true } } },
    }),
    viewAll ? db.candidate.findMany({ where: { assignedToId: null, status: { in: ["LEAD", "CONTACTED", "INTERESTED"] } }, select: { id: true, fullName: true, createdAt: true } }) : Promise.resolve([]),
    db.callLog.findMany({ where: { userId: staffId, createdAt: { gte: r.todayStart } }, orderBy: { createdAt: "desc" }, include: { candidate: { select: { id: true, fullName: true } } } }),
    db.target.findUnique({ where: { userId_month: { userId: staffId, month: monthKey() } } }),
    db.callLog.count({ where: { userId: staffId, createdAt: { gte: r.monthStart } } }),
  ]);

  const staleDays = num(s.leadNoContactDays, 2);
  const leadRows: Row[] = newLeads.map((c) => ({
    id: c.id, name: c.fullName, phone: c.phone, whatsapp: c.whatsapp,
    context: <>Added {relDays(c.createdAt)}{c.campaign ? ` from “${c.campaign.name}”` : ""}{c.jobOrder ? ` · ${c.jobOrder.position}, ${c.jobOrder.country}` : ""}</>,
    tone: c.createdAt < subDays(r.now, staleDays) ? "red" : undefined,
  }));
  const cbRows: Row[] = callbacks.map((c) => ({
    id: c.id, name: c.fullName, phone: c.phone, whatsapp: c.whatsapp, status: c.status, lastOutcome: c.callLogs[0]?.outcome,
    context: <>Call back {c.nextCallAt! < r.todayStart ? `was due ${relDays(c.nextCallAt)}` : `today ${c.nextCallAt!.getHours() ? `at ${d(c.nextCallAt, "HH:mm")}` : ""}`}{c.callLogs[0]?.note ? ` · “${c.callLogs[0].note}”` : ""}</>,
    tone: c.nextCallAt! < r.todayStart ? "red" : undefined,
  }));
  const write = await reminderWriter(who.name);
  const payRows: Row[] = dues.map((x) => ({
    remind: write(x),
    id: x.candidateId, name: x.name, phone: x.phone, whatsapp: x.whatsapp,
    context: <>{x.label}: {money(x.outstanding)} {x.dueDate < r.todayStart ? `overdue since ${d(x.dueDate, "d MMM")}` : "due today"}</>,
    tone: x.dueDate < r.todayStart ? "red" : "amber",
  }));
  const total = leadRows.length + cbRows.length + payRows.length;
  const reached = todayCalls.filter((c) => c.outcome !== "NO_ANSWER").length;
  const dailyTarget = target ? Math.ceil(target.calls / 26) : 0;

  return (
    <>
      <PageHeader
        title={staffId === user.id ? "My call list" : `Call list: ${who.name}`}
        meta={<><span>{d(r.now, "EEEE d MMMM")}</span><span><span className="num">{total}</span> to call</span></>}
        actions={<LinkButton href="/calls/stats">Call counts</LinkButton>}
      />
      <Tabs active="list" items={[{ key: "list", href: "/calls", label: "Today" }, { key: "stats", href: "/calls/stats", label: "Daily & monthly counts" }]} />

      {viewAll && (
        <FilterForm>
          <select name="staff" defaultValue={staffId} className="control !w-[220px]">
            {staffList.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === user.id ? " (me)" : ""}</option>)}
          </select>
        </FilterForm>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5 min-w-0">
          <Section title="Payment follow-ups" note="due today or overdue" actions={<Tag tone={payRows.length ? "red" : "plain"}>{payRows.length}</Tag>} flush>
            <CallRows rows={payRows} empty="No payments due today." />
          </Section>
          <Section title="Call-backs" note="due today or missed" actions={<Tag tone={cbRows.length ? "amber" : "plain"}>{cbRows.length}</Tag>} flush>
            <CallRows rows={cbRows} empty="No call-backs due." />
          </Section>
          <Section title="New leads" note="never called" actions={<Tag tone={leadRows.length ? "blue" : "plain"}>{leadRows.length}</Tag>} flush>
            <CallRows rows={leadRows} empty="No new leads waiting." />
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Today so far">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><div className="label-caps">Calls</div><div className="num text-[24px]">{todayCalls.length}</div></div>
              <div><div className="label-caps">Reached</div><div className="num text-[24px]">{reached}</div></div>
            </div>
            {dailyTarget > 0 && (
              <>
                <div className="flex justify-between text-[12.5px] text-muted mb-1"><span>Daily pace for monthly target</span><span className="num">{todayCalls.length}/{dailyTarget}</span></div>
                <Bar value={todayCalls.length} max={dailyTarget} tone={todayCalls.length >= dailyTarget ? "green" : "ink"} />
                <div className="flex justify-between text-[12.5px] text-muted mt-3 mb-1"><span>Month</span><span className="num">{monthCalls}/{target!.calls}</span></div>
                <Bar value={monthCalls} max={target!.calls} />
              </>
            )}
          </Section>
          {viewAll && unassigned.length > 0 && (
            <Section title="Leads with no staff" actions={<Tag tone="amber">{unassigned.length}</Tag>} flush>
              <ul className="divide-y divide-rule">
                {unassigned.slice(0, 12).map((c) => (
                  <li key={c.id} className="px-4 py-2 text-[13px] flex justify-between gap-2">
                    <Link className="link" href={`/candidates/${c.id}`}>{c.fullName}</Link>
                    <span className="text-muted">{relDays(c.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Logged today" flush>
            {todayCalls.length === 0 ? <Empty>Nothing logged yet.</Empty> : (
              <ul className="divide-y divide-rule max-h-[420px] overflow-y-auto">
                {todayCalls.map((l) => (
                  <li key={l.id} className="px-4 py-2 text-[13px] flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate"><span className="num text-muted mr-2">{d(l.createdAt, "HH:mm")}</span><Link className="row-link" href={`/candidates/${l.candidate.id}`}>{l.candidate.fullName}</Link></span>
                    <OutcomeTag outcome={l.outcome} />
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
