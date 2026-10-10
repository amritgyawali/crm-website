import { ActionForm, Submit } from "@/components/forms";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action";
import { PARTNER_TYPES } from "@/lib/constants";

type P = { name: string; country: string; type: string; phone: string | null; whatsapp: string | null; email: string | null; address: string | null; website: string | null; serviceFeePerWorker: number; commission: string | null; paymentTerms: string | null; status: string; notes: string | null };

export function PartnerForm({ action, p }: { action: (fd: FormData) => Promise<ActionState>; p?: P }) {
  return (
    <ActionForm action={action} reset={false} guard className="space-y-5">
      <FormGrid cols={3}>
        <Field label="Company name" required><Input name="name" required defaultValue={p?.name} /></Field>
        <Field label="Country" required><Input name="country" required defaultValue={p?.country} /></Field>
        <Field label="Partner type" required><Select name="type" required defaultValue={p?.type ?? ""} placeholder="Select…" options={PARTNER_TYPES} /></Field>
        <Field label="Phone"><Input name="phone" type="tel" defaultValue={p?.phone ?? ""} /></Field>
        <Field label="WhatsApp"><Input name="whatsapp" type="tel" defaultValue={p?.whatsapp ?? ""} /></Field>
        <Field label="Email"><Input name="email" type="email" defaultValue={p?.email ?? ""} /></Field>
        <Field label="Address"><Input name="address" defaultValue={p?.address ?? ""} /></Field>
        <Field label="Website"><Input name="website" defaultValue={p?.website ?? ""} /></Field>
        <Field label="Status"><Select name="status" defaultValue={p?.status ?? "ACTIVE"} options={[{ value: "ACTIVE", label: "Active" }, { value: "ON_HOLD", label: "On hold" }, { value: "ENDED", label: "Ended" }]} /></Field>
      </FormGrid>
      {!p && (
        <FormGrid cols={3}>
          <Field label="Main contact person"><Input name="contactName" /></Field>
          <Field label="Their position"><Input name="contactPosition" /></Field>
        </FormGrid>
      )}
      <fieldset>
        <legend className="label-caps mb-3">Agreed terms</legend>
        <FormGrid cols={3}>
          <Field label="Service fee per worker (AED)"><Input name="serviceFeePerWorker" className="num" defaultValue={p?.serviceFeePerWorker ? String(p.serviceFeePerWorker) : ""} /></Field>
          <Field label="Commission"><Input name="commission" defaultValue={p?.commission ?? ""} placeholder="e.g. AED 600 per selected candidate" /></Field>
          <Field label="Payment terms & due dates"><Input name="paymentTerms" defaultValue={p?.paymentTerms ?? ""} placeholder="e.g. 50% on visa, 50% on arrival" /></Field>
        </FormGrid>
      </fieldset>
      <Field label="Notes"><Textarea name="notes" rows={3} defaultValue={p?.notes ?? ""} /></Field>
      <Submit>{p ? "Save changes" : "Add partner"}</Submit>
    </ActionForm>
  );
}
