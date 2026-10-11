import { Tabs } from "@/components/ui";

export function SettingsTabs({ active }: { active: string }) {
  return (
    <Tabs
      active={active}
      items={[
        { key: "general", href: "/settings", label: "Company & rules" },
        { key: "stages", href: "/settings/stages", label: "Stage time limits" },
        { key: "users", href: "/settings/users", label: "Users & roles" },
        { key: "templates", href: "/settings/templates", label: "WhatsApp templates" },
        { key: "duplicates", href: "/settings/duplicates", label: "Duplicates" },
        { key: "activity", href: "/settings/activity", label: "Activity log" },
      ]}
    />
  );
}
