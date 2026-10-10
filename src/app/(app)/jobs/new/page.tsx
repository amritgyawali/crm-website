import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { PageHeader, Section } from "@/components/ui";
import { JobForm } from "../job-form";
import { saveJob } from "../actions";

export const metadata = { title: "New job order" };

export default async function NewJob({ searchParams }: { searchParams: Promise<{ partner?: string }> }) {
  await requirePage("jobs.manage");
  const sp = await searchParams;
  const partners = await db.partner.findMany({ where: { type: { in: ["JOB_ORDERS", "BOTH"] } }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="New job order" back={{ href: "/jobs", label: "Job orders" }} />
      <Section className="max-w-[980px]"><JobForm action={saveJob.bind(null, null)} partners={partners.map((p) => ({ value: p.id, label: `${p.name}, ${p.country}` }))} partnerId={sp.partner} /></Section>
    </>
  );
}
