import { addDays, endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek, format, parse } from "date-fns";

// Week runs Monday–Sunday for "due this week" lists.
export function ranges(now = new Date()) {
  return {
    now,
    todayStart: startOfDay(now),
    todayEnd: endOfDay(now),
    weekStart: startOfWeek(now, { weekStartsOn: 1 }),
    weekEnd: endOfWeek(now, { weekStartsOn: 1 }),
    monthStart: startOfMonth(now),
    monthEnd: endOfMonth(now),
    in7: endOfDay(addDays(now, 7)),
    in30: endOfDay(addDays(now, 30)),
  };
}

export const monthKey = (date = new Date()) => format(date, "yyyy-MM");
export const monthFromKey = (key: string) => parse(key + "-01", "yyyy-MM-dd", new Date());
export const monthLabel = (key: string) => format(monthFromKey(key), "MMMM yyyy");

/** Parse yyyy-mm-dd from a form field into a local date. */
export function parseDateInput(v: FormDataEntryValue | null | undefined): Date | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  const date = v.length > 10 ? new Date(v) : parse(v, "yyyy-MM-dd", new Date());
  return isNaN(date.getTime()) ? null : date;
}
export const toDateInput = (date?: Date | null) => (date ? format(date, "yyyy-MM-dd") : "");
export const toDateTimeInput = (date?: Date | null) => (date ? format(date, "yyyy-MM-dd'T'HH:mm") : "");
