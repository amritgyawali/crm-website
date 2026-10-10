import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAlerts, alertCount } from "@/lib/alerts";
import { Empty, PageHeader, Section, Tag, cx } from "@/components/ui";

export const metadata = { title: "Reminders" };

export default async function AlertsPage() {
  const user = await requireUser();
  const groups = await getAlerts(user);
  const total = alertCount(groups);
  return (
    <>
      <PageHeader title="Reminders" meta={total ? `${total} things need attention` : "Nothing waiting"} />
      <p className="text-[13px] text-muted -mt-3 mb-5 max-w-[720px]">
        Worked out from the records every time this page opens: payments due, call-backs, quiet leads, stuck visa files, passports, partner agreements, office bills and approvals. Clear an item by doing the work; it disappears on its own.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((g) => (
          <Section key={g.key} title={g.title} actions={<Tag tone={g.items.some((i) => i.tone === "danger") ? "red" : g.items.length ? "amber" : "plain"}>{g.items.length}</Tag>} flush>
            {g.items.length === 0 ? <Empty>Clear.</Empty> : (
              <ul className="divide-y divide-rule max-h-[380px] overflow-y-auto">
                {g.items.map((i) => (
                  <li key={g.key + i.id}>
                    <Link href={i.href} className="flex items-start gap-3 px-4 py-2.5 no-underline hover:bg-well/50">
                      <span className={cx("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", i.tone === "danger" ? "bg-danger" : i.tone === "warn" ? "bg-warn" : "bg-rule-2")} />
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-medium">{i.title}</span>
                        <span className={cx("block text-[12.5px]", i.tone === "danger" ? "text-danger" : "text-muted")}>{i.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ))}
      </div>
    </>
  );
}
