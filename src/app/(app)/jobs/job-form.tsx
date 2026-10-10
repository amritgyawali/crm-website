import { ActionForm, Submit } from "@/components/forms";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action";
import { COUNTRIES_DEST, JOB_STATUS } from "@/lib/constants";
import { toDateInput } from "@/lib/dates";

type Job = { reference: string; position: string; employer: string; partnerId: string | null; country: string; city: string | null; vacancies: number; salary: string | null; contractMonths: number; status: string; receivedOn: Date; deadline: Date | null; requirements: string | null };

export function JobForm({ action, partners, job, partnerId }: { action: (fd: FormData) => Promise<ActionState>; partners: { value: string; label: string }[]; job?: Job; partnerId?: string }) {
  return (
    <ActionForm action={action} reset={false} className="space-y-4">
      <FormGrid cols={3}>
        <Field label="Reference / RRF no." required><Input name="reference" required defaultValue={job?.reference} className="uppercase num" /></Field>
        <Field label="Partner" hint="Leave empty for a direct employer"><Select name="partnerId" defaultValue={job?.partnerId ?? partnerId ?? ""} placeholder="Direct employer" options={partners} /></Field>
        <Field label="Status"><Select name="status" defaultValue={job?.status ?? "OPEN"} options={JOB_STATUS} /></Field>
        <Field label="Position" required><Input name="position" required defaultValue={job?.position} /></Field>
        <Field label="Employer" required><Input name="employer" required defaultValue={job?.employer} /></Field>
        <Field label="Vacancies"><Input name="vacancies" type="number" min={1} defaultValue={job?.vacancies ?? 1} /></Field>
        <Field label="Country" required>
          <Input name="country" required list="countries" defaultValue={job?.country} />
          <datalist id="countries">{COUNTRIES_DEST.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="City"><Input name="city" defaultValue={job?.city ?? ""} /></Field>
        <Field label="Contract length (months)"><Input name="contractMonths" type="number" min={1} defaultValue={job?.contractMonths ?? 24} /></Field>
        <Field label="Salary"><Input name="salary" defaultValue={job?.salary ?? ""} placeholder="EUR 1,100 net / month" /></Field>
        <Field label="Received on"><Input name="receivedOn" type="date" defaultValue={toDateInput(job?.receivedOn ?? new Date())} /></Field>
        <Field label="Deadline"><Input name="deadline" type="date" defaultValue={toDateInput(job?.deadline)} /></Field>
      </FormGrid>
      <Field label="Requirements"><Textarea name="requirements" rows={3} defaultValue={job?.requirements ?? ""} /></Field>
      <Submit>{job ? "Save changes" : "Add job order"}</Submit>
    </ActionForm>
  );
}
