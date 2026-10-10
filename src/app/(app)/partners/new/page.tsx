import { requirePage } from "@/lib/auth";
import { PageHeader, Section } from "@/components/ui";
import { PartnerForm } from "../partner-form";
import { savePartner } from "../actions";

export const metadata = { title: "New partner" };

export default async function NewPartner() {
  await requirePage("partners.manage");
  return (
    <>
      <PageHeader title="New partner" back={{ href: "/partners", label: "Partners" }} />
      <Section className="max-w-[980px]"><PartnerForm action={savePartner.bind(null, null)} /></Section>
    </>
  );
}
