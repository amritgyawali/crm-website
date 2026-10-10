import { eachDayOfInterval, endOfMonth, format, getDay, startOfDay, startOfMonth } from "date-fns";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { monthFromKey, monthKey, toDateInput } from "@/lib/dates";
import { ATTENDANCE_LABEL, ATTENDANCE_SHORT, ATTENDANCE_STATUS } from "@/lib/constants";
import { d } from "@/lib/format";
import { PageHeader, Section, TableWrap, cx } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { FilterForm } from "@/components/filter-form";
import { StaffTabs } from "../tabs";
import { checkInOut } from "../actions";
import { AttendanceSetter } from "./setter";

export const metadata = { title: "Attendance" };

const CELL: Record<string, string> = {
  PRESENT: "text-ink", LATE: "text-warn font-medium", HALF_DAY: "text-info", ABSENT: "text-danger font-semibold bg-danger-tint", LEAVE: "text-accent", HOLIDAY: "text-muted",
};

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const mk = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : monthKey();
  const m = monthFromKey(mk);
  const manage = can(user.role, "staff.manage");
  const staff = await db.user.findMany({ where: manage ? { active: true, role: { not: "ADMIN" } } : { id: user.id }, orderBy: { name: "asc" } });
  const rows = await db.attendance.findMany({ where: { userId: { in: staff.map((s) => s.id) }, date: { gte: startOfMonth(m), lte: endOfMonth(m) } } });
  const days = eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) });
  const today = startOfDay(new Date());
  const mine = await db.attendance.findUnique({ where: { userId_date: { userId: user.id, date: today } } });
  const key = (u: string, day: Date) => `${u}|${format(day, "yyyy-MM-dd")}`;
  const map = new Map(rows.map((r) => [key(r.userId, r.date), r]));

  return (
    <>
      <PageHeader
        title="Attendance"
        meta={d(m, "MMMM yyyy")}
        actions={
          <div className="flex items-center gap-3 text-[13px]">
            {mine && <span className="text-muted">In {mine.checkIn ?? "—"}{mine.checkOut ? `, out ${mine.checkOut}` : ""}</span>}
            {!mine?.checkOut && <ActionButton action={checkInOut} variant="primary" size="md">{mine ? "Check out" : "Check in"}</ActionButton>}
          </div>
        }
      />
      <StaffTabs active="attendance" role={user.role} />
      <FilterForm><input type="month" name="month" defaultValue={mk} className="control !w-[170px]" /></FilterForm>

      <Section flush>
        <TableWrap>
          <table className="grid-table !text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1]">Staff</th>
                {days.map((day) => <th key={day.toISOString()} className={cx("!px-1 text-center", getDay(day) === 0 && "!text-rule-2")}>{format(day, "d")}<div className="font-normal normal-case tracking-normal">{format(day, "EEEEE")}</div></th>)}
                <th className="r">P</th><th className="r">Late</th><th className="r">Abs</th><th className="r">Leave</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const mineRows = rows.filter((r) => r.userId === s.id);
                const c = (st: string) => mineRows.filter((r) => r.status === st).length;
                return (
                  <tr key={s.id}>
                    <td className="sticky left-0 bg-sheet whitespace-nowrap font-medium !text-[13px]">{s.name}</td>
                    {days.map((day) => {
                      const a = map.get(key(s.id, day));
                      const sunday = getDay(day) === 0;
                      return (
                        <td key={day.toISOString()} title={a ? `${ATTENDANCE_LABEL[a.status]}${a.checkIn ? `, in ${a.checkIn}` : ""}${a.checkOut ? `, out ${a.checkOut}` : ""}` : ""}
                          className={cx("!px-1 text-center num", a ? CELL[a.status] : "", sunday && "bg-well/60", +day === +today && "outline outline-1 outline-ink -outline-offset-1")}>
                          {a ? ATTENDANCE_SHORT[a.status] : sunday || day > today ? "" : "·"}
                        </td>
                      );
                    })}
                    <td className="r num">{c("PRESENT") + c("LATE")}</td>
                    <td className="r num">{c("LATE") || ""}</td>
                    <td className={cx("r num", c("ABSENT") && "text-danger")}>{c("ABSENT") || ""}</td>
                    <td className="r num">{c("LEAVE") || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        <p className="px-4 py-2 text-[12px] text-muted border-t border-rule">
          {ATTENDANCE_STATUS.map((a) => `${a.short} ${a.label}`).join(" · ")}. Check-in after 09:15 is marked late. Sundays are off.
        </p>
      </Section>

      {manage && (
        <Section title="Correct a day" className="mt-5 max-w-[880px]">
          <AttendanceSetter staff={staff.map((s) => ({ value: s.id, label: s.name }))} today={toDateInput(today)} />
        </Section>
      )}
    </>
  );
}
