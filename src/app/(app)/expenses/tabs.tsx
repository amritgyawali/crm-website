import { Tabs } from "@/components/ui";

export function ExpenseTabs({ active }: { active: string }) {
  return (
    <Tabs
      active={active}
      items={[
        { key: "overview", href: "/expenses", label: "This month" },
        { key: "bills", href: "/expenses/bills", label: "Recurring bills" },
        { key: "list", href: "/expenses/list", label: "Expenses" },
        { key: "report", href: "/expenses/report", label: "Monthly report" },
      ]}
    />
  );
}
