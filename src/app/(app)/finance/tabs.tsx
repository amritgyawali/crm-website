import { Tabs } from "@/components/ui";
import { can } from "@/lib/permissions";

export function FinanceTabs({ active, role }: { active: string; role: string }) {
  const items = [
    { key: "due", href: "/finance", label: "Due & overdue" },
    ...(can(role, "finance.view")
      ? [
          { key: "collections", href: "/finance/collections", label: "Daily collections" },
          { key: "payments", href: "/finance/payments", label: "All payments" },
          { key: "refunds", href: "/finance/refunds", label: "Refunds" },
          { key: "packages", href: "/finance/packages", label: "Fee packages & limits" },
        ]
      : []),
  ];
  return <Tabs items={items} active={active} />;
}
