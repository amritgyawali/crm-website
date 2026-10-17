import { db } from "./db";
import { getSettings } from "./settings";
import { SETTING_DEFAULTS } from "./constants";
import { demoMode } from "./database-url";

export type Check = { ok: boolean; level: "red" | "amber" | "info"; title: string; detail: string };

/** Things to sort out before (and while) the office uses the system for real. */
export async function setupChecks(): Promise<Check[]> {
  const s = await getSettings();
  const secret = process.env.SESSION_SECRET ?? "";
  const demoUsers = await db.user.count({ where: { email: { endsWith: "@office.test" }, active: true } });
  const leadsKey = process.env.LEADS_API_KEY ?? "";

  return [
    {
      ok: !demoMode(), level: "red",
      title: "Database",
      detail: demoMode() ? "Not connected: demo mode, on sample data that resets when the server restarts. Nothing entered here is kept. See /setup to connect one." : "Connected.",
    },
    {
      ok: secret.length >= 32 && !secret.startsWith("change-me"), level: "red",
      title: "Sign-in secret key",
      detail: secret.startsWith("change-me") ? "SESSION_SECRET is still the example value. Set a long random value in the environment and redeploy / restart." : secret.length < 32 ? "SESSION_SECRET is shorter than 32 characters." : "Set.",
    },
    {
      ok: demoUsers === 0, level: "red",
      title: "Demo logins",
      detail: demoUsers ? `${demoUsers} demo accounts (@office.test, password office123) are active. Disable them under Users & roles before real use.` : "None active.",
    },
    {
      ok: s.companyName !== SETTING_DEFAULTS.companyName && s.companyName !== "Recruitment Office", level: "amber",
      title: "Company details on receipts",
      detail: s.companyName === SETTING_DEFAULTS.companyName || s.companyName === "Recruitment Office" ? "The company name is still the placeholder. Fill in the details below." : `Receipts print as “${s.companyName}”.`,
    },
    {
      ok: true, level: "info",
      title: "Backups",
      detail: "Kept by your database host. Check that automatic backups or point-in-time restore are on in its dashboard.",
    },
    { ok: true, level: "info", title: "Office time zone", detail: `${process.env.TZ ?? "server default"}. “Today” and month totals follow this clock (OFFICE_TIMEZONE).` },
    {
      ok: !!leadsKey && !leadsKey.startsWith("change-me"), level: "info",
      title: "Lead intake (Zapier / Make)",
      detail: leadsKey && !leadsKey.startsWith("change-me") ? "On, at /api/leads." : "Off. Set LEADS_API_KEY to accept leads at /api/leads.",
    },
    {
      ok: !!(process.env.META_VERIFY_TOKEN && process.env.META_APP_SECRET), level: "info",
      title: "Facebook / Instagram Lead Ads",
      detail: process.env.META_VERIFY_TOKEN && process.env.META_APP_SECRET ? `On, at /api/leads/meta${process.env.META_PAGE_TOKEN ? "" : " (META_PAGE_TOKEN missing: lead details can't be fetched)"}.` : "Off. See README to connect.",
    },
    { ok: !!process.env.ANTHROPIC_API_KEY, level: "info", title: "Passport photo reading", detail: process.env.ANTHROPIC_API_KEY ? "On." : "Off. Pasting the passport lines still works. Set ANTHROPIC_API_KEY to read photos." },
  ];
}
