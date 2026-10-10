import { ActionForm, Submit } from "@/components/forms";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action";
import { PLATFORMS } from "@/lib/constants";
import { toDateInput } from "@/lib/dates";

type C = { name: string; platform: string; jobOrderId: string | null; startDate: Date; endDate: Date | null; amountSpent: number; externalId: string | null; notes: string | null };

export function CampaignForm({ action, jobs, c }: { action: (fd: FormData) => Promise<ActionState>; jobs: { value: string; label: string }[]; c?: C }) {
  return (
    <ActionForm action={action} reset={false} className="space-y-3.5">
      <FormGrid cols={2}>
        <Field label="Campaign name" required><Input name="name" required defaultValue={c?.name} placeholder="Croatia hotel jobs, October boost" /></Field>
        <Field label="Job order it promotes"><Select name="jobOrderId" defaultValue={c?.jobOrderId ?? ""} placeholder="General / several jobs" options={jobs} /></Field>
      </FormGrid>
      <FormGrid cols={4}>
        <Field label="Platform" required><Select name="platform" required defaultValue={c?.platform ?? ""} placeholder="Select…" options={PLATFORMS} /></Field>
        <Field label="Start date" required><Input name="startDate" type="date" required defaultValue={toDateInput(c?.startDate ?? new Date())} /></Field>
        <Field label="End date"><Input name="endDate" type="date" defaultValue={toDateInput(c?.endDate)} /></Field>
        <Field label="Amount spent (AED)"><Input name="amountSpent" className="num" defaultValue={c ? String(c.amountSpent) : ""} /></Field>
      </FormGrid>
      <Field label="Lead form / ad ID" hint="Used to match leads sent in automatically from Facebook or Instagram lead forms"><Input name="externalId" defaultValue={c?.externalId ?? ""} className="num" /></Field>
      <Field label="Notes"><Textarea name="notes" rows={2} defaultValue={c?.notes ?? ""} /></Field>
      <Submit>{c ? "Save changes" : "Add campaign"}</Submit>
    </ActionForm>
  );
}
