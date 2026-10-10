import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { toDateInput } from "@/lib/dates";
import { PageHeader, Section } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { CandidateForm } from "../../candidate-form";
import { candidateFormOptions } from "../../options";
import { deleteCandidate, updateCandidate } from "../../actions";

export const metadata = { title: "Edit candidate" };

export default async function EditCandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage("candidate.edit");
  const c = await db.candidate.findUnique({ where: { id } });
  if (!c) notFound();
  const opts = await candidateFormOptions();
  // keep the current job order selectable even when it is closed
  if (c.jobOrderId && !opts.jobs.some((j) => j.value === c.jobOrderId)) {
    const j = await db.jobOrder.findUnique({ where: { id: c.jobOrderId } });
    if (j) opts.jobs.unshift({ value: j.id, label: `${j.position}, ${j.country} · ${j.reference}` });
  }
  if (c.campaignId && !opts.campaigns.some((x) => x.value === c.campaignId)) {
    const x = await db.campaign.findUnique({ where: { id: c.campaignId } });
    if (x) opts.campaigns.unshift({ value: x.id, label: x.name });
  }
  if (c.sourcePartnerId && !opts.partners.some((x) => x.value === c.sourcePartnerId)) {
    const x = await db.partner.findUnique({ where: { id: c.sourcePartnerId } });
    if (x) opts.partners.unshift({ value: x.id, label: x.name });
  }
  const defaults = Object.fromEntries(
    Object.entries(c).map(([k, v]) => [k, v instanceof Date ? toDateInput(v) : v === null ? null : String(v)]),
  );
  return (
    <>
      <PageHeader
        title={`Edit ${c.fullName}`}
        back={{ href: `/candidates/${c.id}`, label: c.fullName }}
        actions={can(user.role, "candidate.delete") && <ActionButton action={deleteCandidate.bind(null, c.id)} variant="danger" confirm="Delete this candidate and all their calls and documents? This cannot be undone.">Delete candidate</ActionButton>}
      />
      <Section className="max-w-[980px]">
        <CandidateForm
          action={updateCandidate.bind(null, c.id)}
          {...opts}
          defaults={defaults}
          canAssign={can(user.role, "candidate.assign")}
          canStatus={can(user.role, "candidate.assign")}
          submitLabel="Save changes"
        />
      </Section>
    </>
  );
}
