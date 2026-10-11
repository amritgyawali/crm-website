// Runs once when the server starts. "Today", "due this week" and month totals follow the office clock,
// not wherever the server happens to be hosted. Set OFFICE_TIMEZONE to change it.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = process.env.OFFICE_TIMEZONE || process.env.TZ || "Asia/Dubai";
  }
}
