import { endOfDay, endOfMonth, startOfDay, startOfMonth } from "date-fns";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { monthFromKey, monthKey, parseDateInput, toDateInput } from "@/lib/dates";
import { d, pct } from "@/lib/format";
import { Money, PageHeader, Section, TableWrap, Tabs, btn } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";

export const metadata = { title: "Call counts" };

async function countsFor(from: Date, to: Date, userIds: string[]) {
  const [calls, enrolled, pays] = await Promise.all([
    db.callLog.groupBy({ by: ["userId", "outcome"], where: { createdAt: { gte: from, lte: to }, userId: { in: userIds } }, _count: true }),
    db.candidate.groupBy({ by: ["assignedToId"], where: { enrolledOn: { gte: from, lte: to }, assignedToId: { in: userIds } }, _count: true }),
    db.payment.findMany({ where: { date: { gte: from, lte: to }, candidate: { assignedToId: { in: userIds } } }, select: { amount: true, candidate: { select: { assignedToId: true } } } }),
  ]);
  return userIds.map((id) => {
    const mine = calls.filter((c) => c.userId === id);
    const total = mine.reduce((s, c) => s + c._count, 0);
    const of = (o: string) => mine.find((c) => c.outcome === o)?._count ?? 0;
    return {
      id, total,
      reached: total - of("NO_ANSWER"),
      interested: of("INTERESTED"),
      enrolled: enrolled.find((e) => e.assignedToId === id)?._count ?? 0,
      promised: of("PAYMENT_PROMISED"),
      collected: pays.filter((p) => p.candidate.assignedToId === id).reduce((s, p) => s + p.amount, 0),
    };
  });
}

function CountTable({ rows, names, targets }: { rows: Awaited<ReturnType<typeof countsFor>>; names: Map<string, string>; targets?: Map<string, { calls: number; enrolments: number; collection: number }> }) {
  const sum = (k: "total" | "reached" | "interested" | "enrolled" | "promised" | "collected") => rows.reduce((s, r) => s + r[k], 0);
  return (
    <TableWrap>
      <table className="grid-table">
        <thead><tr><th>Staff</th><th className="r">Calls</th><th className="r">Reached</th><th className="r">Interested</th><th className="r">Enrolled</th><th className="r">Payment promised</th><th className="r">Collected (AED)</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const t = targets?.get(r.id);
            return (
              <tr key={r.id}>
                <td className="font-medium">{names.get(r.id)}</td>
                <td className="r num">{r.total}{t?.calls ? <span className="text-muted text-[12px]"> / {t.calls}</span> : null}</td>
                <td className="r num">{r.reached} <span className="text-muted text-[12px]">{pct(r.reached, r.total)}%</span></td>
                <td className="r num">{r.interested}</td>
                <td className="r num">{r.enrolled}{t?.enrolments ? <span className="text-muted text-[12px]"> / {t.enrolments}</span> : null}</td>
                <td className="r num">{r.promised}</td>
                <td className="r"><Money v={r.collected} />{t?.collection ? <div className="text-muted text-[12px] num">of {t.collection.toLocaleString()}</div> : null}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot><tr><td>Total</td><td className="r num">{sum("total")}</td><td className="r num">{sum("reached")}</td><td className="r num">{sum("interested")}</td><td className="r num">{sum("enrolled")}</td><td className="r num">{sum("promised")}</td><td className="r"><Money v={sum("collected")} /></td></tr></tfoot>
      </table>
    </TableWrap>
  );
}

export default async function CallStatsPage({ searchParams }: { searchParams: Promise<{ day?: string; month?: string }> }) {
  const user = await requirePage("call.log");
  const sp = await searchParams;
  const day = parseDateInput(sp.day ?? null) ?? new Date();
  const mk = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : monthKey();
  const m = monthFromKey(mk);
  const staff = await db.user.findMany({
    where: can(user.role, "calls.viewAll") ? { active: true, role: { in: ["SALES", "MANAGEMENT", "OPERATIONS"] } } : { id: user.id },
    orderBy: { name: "asc" },
  });
  const ids = staff.map((s) => s.id);
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const [daily, monthly, targets] = await Promise.all([
    countsFor(startOfDay(day), endOfDay(day), ids),
    countsFor(startOfMonth(m), endOfMonth(m), ids),
    db.target.findMany({ where: { month: mk, userId: { in: ids } } }),
  ]);

  return (
    <>
      <PageHeader title="Call counts" meta="Calls are counted by who logged them. Enrolments and collections are counted for the candidates each person follows." />
      <Tabs active="stats" items={[{ key: "list", href: "/calls", label: "Today" }, { key: "stats", href: "/calls/stats", label: "Daily & monthly counts" }]} />
      <FilterForm>
        <label className="text-[12.5px] text-muted">Day<input type="date" name="day" defaultValue={toDateInput(day)} className="control mt-0.5" /></label>
        <label className="text-[12.5px] text-muted">Month<input type="month" name="month" defaultValue={mk} className="control mt-0.5" /></label>
        {can(user.role, "reports.view") && <a className={btn("secondary")} href={`/api/export/calls?month=${mk}`}>Export month</a>}
      </FilterForm>
      <div className="space-y-5">
        <Section title={`Day: ${d(day, "EEEE d MMM yyyy")}`} flush><CountTable rows={daily} names={names} /></Section>
        <Section title={`Month: ${d(m, "MMMM yyyy")}`} note="with monthly targets" flush>
          <CountTable rows={monthly} names={names} targets={new Map(targets.map((t) => [t.userId, t]))} />
        </Section>
      </div>
    </>
  );
}
