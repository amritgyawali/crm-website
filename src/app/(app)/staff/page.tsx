import { differenceInCalendarDays, endOfMonth, subMonths, format } from "date-fns";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { monthFromKey, monthKey } from "@/lib/dates";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { d, money, pct } from "@/lib/format";
import { Bar, Disclose, Field, Input, Money, PageHeader, Section, TableWrap, cx } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { FilterForm } from "@/components/filter-form";
import { StaffTabs } from "./tabs";
import { performance } from "./perf";
import { saveTarget } from "./actions";

export const metadata = { title: "Staff" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const mk = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : monthKey();
  const m = monthFromKey(mk);
  const manage = can(user.role, "staff.manage");
  const staff = await db.user.findMany({
    where: manage ? { active: true, role: { in: ["SALES", "MANAGEMENT", "OPERATIONS", "FINANCE"] } } : { id: user.id },
    orderBy: [{ role: "desc" }, { name: "asc" }],
  });
  const ids = staff.map((s) => s.id);
  const [targets, perf, history] = await Promise.all([
    db.target.findMany({ where: { month: mk, userId: { in: ids } } }),
    performance(ids, m),
    Promise.all([5, 4, 3, 2, 1, 0].map(async (i) => ({ month: subMonths(m, i), perf: await performance(ids, subMonths(m, i)) }))),
  ]);
  const now = new Date();
  const monthEnd = endOfMonth(m);
  const elapsed = m > now ? 0 : monthEnd < now ? 1 : (differenceInCalendarDays(now, m) + 1) / (differenceInCalendarDays(monthEnd, m) + 1);

  const metric = (label: string, done: number, target: number, isMoney?: boolean) => {
    const pace = target * elapsed;
    const behind = target > 0 && done < pace * 0.85;
    return (
      <div>
        <div className="flex justify-between text-[12.5px] mb-1">
          <span className="text-muted">{label}</span>
          <span className="num">{isMoney ? money(done, { whole: true, cur: false }) : done}{target > 0 && <span className="text-muted"> / {isMoney ? money(target, { whole: true, cur: false }) : target}</span>}</span>
        </div>
        <Bar value={done} max={target || Math.max(done, 1)} tone={target && done >= target ? "green" : behind ? "amber" : "ink"} />
        {target > 0 && <div className={cx("text-[11.5px] mt-0.5", behind ? "text-warn" : "text-muted")}>{pct(done, target)}% · {behind ? "behind pace" : "on pace"}</div>}
      </div>
    );
  };

  return (
    <>
      <PageHeader title={manage ? "Staff" : "My targets"} meta={`${d(m, "MMMM yyyy")}${elapsed > 0 && elapsed < 1 ? ` · ${Math.round(elapsed * 100)}% of the month gone` : ""}`} />
      <StaffTabs active="targets" role={user.role} />
      <FilterForm><input type="month" name="month" defaultValue={mk} className="control !w-[170px]" /></FilterForm>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {staff.map((s) => {
          const t = targets.find((x) => x.userId === s.id);
          const p = perf.get(s.id)!;
          return (
            <Section key={s.id} title={s.name} note={ROLE_LABEL[s.role as Role]}>
              <div className="space-y-3">
                {metric("Calls", p.calls, t?.calls ?? 0)}
                {metric("Enrolments", p.enrolments, t?.enrolments ?? 0)}
                {metric("Collected (AED)", p.collection, t?.collection ?? 0, true)}
              </div>
              {manage && (
                <Disclose label={t ? "Change target" : "Set target"} className="mt-4">
                  <ActionForm action={saveTarget.bind(null, s.id, mk)} reset={false} className="grid grid-cols-3 gap-2 pt-2 items-end">
                    <Field label="Calls"><Input name="calls" type="number" defaultValue={t?.calls ?? ""} /></Field>
                    <Field label="Enrolments"><Input name="enrolments" type="number" defaultValue={t?.enrolments ?? ""} /></Field>
                    <Field label="Collection"><Input name="collection" className="num" defaultValue={t?.collection ?? ""} /></Field>
                    <div className="col-span-3"><Submit size="sm">Save target</Submit></div>
                  </ActionForm>
                </Disclose>
              )}
            </Section>
          );
        })}
      </div>

      <Section title="Performance record" note="last six months" className="mt-5" flush>
        <TableWrap>
          <table className="grid-table">
            <thead>
              <tr><th>Staff</th>{history.map((h) => <th key={h.month.toISOString()} className="r">{format(h.month, "MMM")}</th>)}</tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium whitespace-nowrap">{s.name}</td>
                  {history.map((h) => {
                    const p = h.perf.get(s.id)!;
                    return (
                      <td key={h.month.toISOString()} className="r text-[12.5px] whitespace-nowrap">
                        <div className="num">{p.calls} calls</div>
                        <div className="num text-muted">{p.enrolments} enrolled</div>
                        <div className="num text-muted"><Money v={p.collection} zero="0" /></div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
