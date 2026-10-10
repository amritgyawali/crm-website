import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader, Section } from "@/components/ui";
import { passportAiEnabled } from "@/lib/passport-ai";
import { CandidateForm } from "../candidate-form";
import { candidateFormOptions } from "../options";
import { createCandidate } from "../actions";

export const metadata = { title: "New candidate" };

export default async function NewCandidatePage({ searchParams }: { searchParams: Promise<{ job?: string; campaign?: string }> }) {
  const user = await requirePage("candidate.edit");
  const sp = await searchParams;
  const opts = await candidateFormOptions();
  return (
    <>
      <PageHeader title="New candidate" back={{ href: "/candidates", label: "Candidates" }} meta="Lead source is required so campaign reports stay accurate." />
      <Section className="max-w-[980px]">
        <CandidateForm
          action={createCandidate}
          {...opts}
          defaults={{ jobOrderId: sp.job ?? null, campaignId: sp.campaign ?? null, leadSource: sp.campaign ? "CAMPAIGN" : null, assignedToId: user.role === "SALES" ? user.id : null }}
          canAssign={can(user.role, "candidate.assign")}
          photoScan={passportAiEnabled()}
          submitLabel="Save candidate"
        />
      </Section>
    </>
  );
}
