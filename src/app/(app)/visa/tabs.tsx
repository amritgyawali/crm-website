import { Tabs } from "@/components/ui";

export function VisaTabs({ active }: { active: "overview" | "board" }) {
  return <Tabs active={active} items={[{ key: "overview", href: "/visa", label: "Overview" }, { key: "board", href: "/visa/board", label: "Board" }]} />;
}
