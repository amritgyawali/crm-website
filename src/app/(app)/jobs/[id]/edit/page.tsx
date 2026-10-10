import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { PageHeader, Section } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { JobForm } from "../../job-form";
import { deleteJob, saveJob } from "../../actions";

export const metadata = { title: "Edit job order" };

export default async function EditJob({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("jobs.manage");
  const { id } = await params;
  const job = await db.jobOrder.findUnique({ where: { id } });
  if (!job) notFound();
  const partners = await db.partner.findMany({ where: { type: { in: ["JOB_ORDERS", "BOTH"] } }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title={`Edit ${job.reference}`} back={{ href: `/jobs/${id}`, label: job.reference }} actions={<ActionButton action={deleteJob.bind(null, id)} variant="danger" confirm="Delete this job order?">Delete</ActionButton>} />
      <Section className="max-w-[980px]"><JobForm action={saveJob.bind(null, id)} job={job} partners={partners.map((p) => ({ value: p.id, label: `${p.name}, ${p.country}` }))} /></Section>
    </>
  );
}
