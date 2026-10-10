import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { getAlerts, alertCount } from "@/lib/alerts";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { Sidebar, type NavGroup } from "@/components/sidebar";
import { Shortcuts } from "@/components/shortcuts";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const s = await getSettings();
  const alerts = alertCount(await getAlerts(user));
  const r = user.role;

  const groups: NavGroup[] = [
    {
      items: [
        { href: "/", label: "Today" },
        ...(can(r, "call.log") ? [{ href: "/calls", label: "Call list" }] : []),
        { href: "/alerts", label: "Reminders", count: alerts, urgent: alerts > 0 },
      ],
    },
    {
      label: "Records",
      items: [
        { href: "/candidates", label: "Candidates" },
        { href: "/jobs", label: "Job orders" },
        { href: "/partners", label: "Partners" },
        { href: "/visa", label: "Visa & deployment" },
      ],
    },
    {
      label: "Money",
      items: [
        ...(can(r, "finance.view") || can(r, "payment.record") ? [{ href: "/finance", label: "Fees & collections" }] : []),
        ...(can(r, "expenses.manage") ? [{ href: "/expenses", label: "Office expenses" }] : []),
        ...(can(r, "campaigns.view") ? [{ href: "/campaigns", label: "Campaigns" }] : []),
      ],
    },
    {
      label: "Office",
      items: [
        { href: "/staff", label: can(r, "staff.manage") ? "Staff" : "My targets" },
        ...(can(r, "reports.view") ? [{ href: "/reports", label: "Reports & export" }] : []),
        ...(can(r, "settings.manage") ? [{ href: "/settings", label: "Settings" }] : []),
      ],
    },
  ].filter((g) => g.items.length);

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <Link href="/account" className="block text-[13px] font-medium truncate no-underline hover:underline">{user.name}</Link>
        <div className="text-[11.5px] text-muted">{ROLE_LABEL[user.role as Role]}</div>
      </div>
      <form action={logout}>
        <button className="text-[12px] text-muted hover:text-ink underline underline-offset-2">Sign out</button>
      </form>
    </div>
  );

  return (
    <div className="lg:flex min-h-screen">
      <Shortcuts />
      <Sidebar groups={groups} company={s.companyName} footer={footer} />
      <div className="flex-1 min-w-0">
        <div className="no-print hidden lg:flex items-center justify-between gap-4 h-14 px-8 border-b border-rule bg-paper/95 sticky top-0 z-10 backdrop-blur-[2px]">
          <form action="/candidates" className="w-full max-w-[420px]">
            <div className="relative">
              <input
                name="q"
                data-search
                placeholder="Find candidate by name, phone, passport or code"
                className="control !min-h-[32px] !py-1 pr-8 text-[13px]"
                aria-label="Search candidates"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 num text-[11px] text-muted border border-rule-2 rounded-[2px] px-1 leading-[16px]">/</kbd>
            </div>
          </form>
          <div className="flex items-center gap-4 text-[13px]">
            {can(r, "candidate.edit") && (
              <Link href="/candidates/new" className="no-underline font-medium text-accent hover:underline">+ New candidate</Link>
            )}
            <span className="text-muted num">{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>
        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
