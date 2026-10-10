import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEvents, EVENT_TYPES, type CalEvent } from "@/lib/calendar";
import { monthFromKey, monthKey, parseDateInput } from "@/lib/dates";
import { d } from "@/lib/format";
import { Empty, PageHeader, Section, btn, cx } from "@/components/ui";

export const metadata = { title: "Calendar" };

const COLOR = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t.color])) as Record<string, string>;
const LABEL = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t.label])) as Record<string, string>;

function EventLine({ e, compact }: { e: CalEvent; compact?: boolean }) {
  return (
    <Link href={e.href} title={`${LABEL[e.type]}: ${e.title}, ${e.detail}`}
      className={cx("block no-underline border-l-[3px] pl-1.5 leading-tight hover:bg-well", compact ? "text-[11.5px] py-[1px] truncate" : "text-[13px] py-1.5")}
      style={{ borderColor: COLOR[e.type] }}>
      {e.timed && <span className="num text-muted mr-1">{format(e.date, "HH:mm")}</span>}
      <span className={cx(e.late && "text-danger")}>{e.title}</span>
      {!compact && <div className={cx("text-[12px]", e.late ? "text-danger" : "text-muted")}>{LABEL[e.type]} · {e.detail}{e.late ? " · late" : ""}</div>}
    </Link>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; day?: string; mine?: string; hide?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const mk = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : monthKey();
  const m = monthFromKey(mk);
  const day = parseDateInput(sp.day ?? null) ?? (isSameMonth(new Date(), m) ? new Date() : m);
  const canAll = can(user.role, "calls.viewAll") || can(user.role, "finance.view") || can(user.role, "stage.update");
  const mineOnly = sp.mine === "1" || !canAll;
  const hidden = new Set((sp.hide ?? "").split(",").filter(Boolean));

  const gridStart = startOfWeek(startOfMonth(m), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(m), { weekStartsOn: 1 });
  const all = await getEvents(user, gridStart, gridEnd, mineOnly);
  const events = all.filter((e) => !hidden.has(e.type));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const today = new Date();
  const counts = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, all.filter((e) => e.type === t.key).length]));
  const present = EVENT_TYPES.filter((t) => counts[t.key]);

  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ month: mk, mine: sp.mine, hide: sp.hide, day: sp.day, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/calendar?${q}`;
  };
  const toggle = (k: string) => {
    const h = new Set(hidden);
    if (h.has(k)) h.delete(k);
    else h.add(k);
    return link({ hide: [...h].join(",") || undefined });
  };
  const dayEvents = events.filter((e) => isSameDay(e.date, day));

  return (
    <>
      <PageHeader
        title={format(m, "MMMM yyyy")}
        meta={<span>{mineOnly ? "Your candidates" : "Whole office"} · {events.length} items</span>}
        actions={
          <>
            <Link className={btn("secondary")} href={link({ month: monthKey(subMonths(m, 1)), day: undefined })}>← {format(subMonths(m, 1), "MMM")}</Link>
            <Link className={btn("secondary")} href={link({ month: monthKey(), day: undefined })}>This month</Link>
            <Link className={btn("secondary")} href={link({ month: monthKey(addMonths(m, 1)), day: undefined })}>{format(addMonths(m, 1), "MMM")} →</Link>
            {canAll && <Link className={btn("ghost")} href={link({ mine: mineOnly ? undefined : "1" })}>{mineOnly ? "Whole office" : "Only mine"}</Link>}
          </>
        }
      />

      <div className="flex flex-wrap gap-1.5 mb-4">
        {present.map((t) => (
          <Link key={t.key} href={toggle(t.key)} className={cx("inline-flex items-center gap-1.5 h-7 px-2.5 border rounded-[3px] text-[12.5px] no-underline", hidden.has(t.key) ? "border-rule text-muted line-through bg-transparent" : "border-rule-2 bg-field")}>
            <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: t.color, opacity: hidden.has(t.key) ? 0.35 : 1 }} />
            {t.label}<span className="num text-muted">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="bg-sheet border border-rule rounded-[3px] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-rule">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => <div key={w} className="label-caps px-2 py-1.5 text-[10.5px]">{w}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((dd) => {
              const list = events.filter((e) => isSameDay(e.date, dd));
              const selected = isSameDay(dd, day);
              return (
                <div key={dd.toISOString()} className={cx("min-h-[112px] border-b border-r border-rule p-1 flex flex-col [&:nth-child(7n)]:border-r-0", !isSameMonth(dd, m) && "bg-well/40", selected && "outline outline-2 outline-ink -outline-offset-2")}>
                  <Link href={link({ day: format(dd, "yyyy-MM-dd") })} className={cx("num text-[12px] no-underline self-start px-1 rounded-[2px]", isSameDay(dd, today) ? "bg-ink text-paper" : isSameMonth(dd, m) ? "text-ink" : "text-muted")}>
                    {format(dd, "d")}
                  </Link>
                  <div className="mt-0.5 space-y-[2px] min-w-0">
                    {list.slice(0, 4).map((e) => <EventLine key={e.id} e={e} compact />)}
                    {list.length > 4 && <Link href={link({ day: format(dd, "yyyy-MM-dd") })} className="block text-[11px] text-muted no-underline hover:underline pl-1.5">+{list.length - 4} more</Link>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Section title={d(day, "EEEE d MMMM")} note={`${dayEvents.length} items`} flush>
          {dayEvents.length === 0 ? <Empty>Nothing on this day.</Empty> : (
            <div className="p-3 space-y-1.5">{dayEvents.map((e) => <EventLine key={e.id} e={e} />)}</div>
          )}
        </Section>
      </div>
    </>
  );
}
