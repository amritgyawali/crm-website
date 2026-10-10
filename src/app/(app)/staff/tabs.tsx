import { Tabs } from "@/components/ui";
import { can } from "@/lib/permissions";

export function StaffTabs({ active, role }: { active: string; role: string }) {
  return (
    <Tabs
      active={active}
      items={[
        { key: "targets", href: "/staff", label: "Targets & performance" },
        { key: "attendance", href: "/staff/attendance", label: "Attendance" },
        ...(can(role, "payroll.manage") ? [{ key: "payroll", href: "/staff/payroll", label: "Payroll" }] : []),
      ]}
    />
  );
}
