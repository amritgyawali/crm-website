import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { PageHeader, Section } from "@/components/ui";
import { PartnerForm } from "../../partner-form";
import { savePartner } from "../../actions";

export const metadata = { title: "Edit partner" };

export default async function EditPartner({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("partners.manage");
  const { id } = await params;
  const p = await db.partner.findUnique({ where: { id } });
  if (!p) notFound();
  return (
    <>
      <PageHeader title={`Edit ${p.name}`} back={{ href: `/partners/${id}`, label: p.name }} />
      <Section className="max-w-[980px]"><PartnerForm action={savePartner.bind(null, id)} p={p} /></Section>
    </>
  );
}
