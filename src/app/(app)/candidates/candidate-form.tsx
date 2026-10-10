"use client";

import { useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action";
import { CANDIDATE_STATUS, LEAD_SOURCES, NATIONALITIES } from "@/lib/constants";
import { PassportFill } from "./passport-fill";

type Opt = { value: string; label: string };
type Defaults = Partial<Record<string, string | null>>;

export function CandidateForm({
  action, defaults = {}, campaigns, partners, jobs, staff, canAssign, canStatus, submitLabel, photoScan = false,
}: {
  photoScan?: boolean;
  action: (fd: FormData) => Promise<ActionState>;
  defaults?: Defaults;
  campaigns: Opt[];
  partners: Opt[];
  jobs: Opt[];
  staff: Opt[];
  canAssign: boolean;
  canStatus?: boolean;
  submitLabel: string;
}) {
  const [source, setSource] = useState(defaults.leadSource ?? "");
  const v = (k: string) => defaults[k] ?? "";

  return (
    <ActionForm action={action} reset={false} className="space-y-6">
      <PassportFill photoEnabled={photoScan} />
      <fieldset>
        <legend className="label-caps mb-3">Where did this candidate come from?</legend>
        <FormGrid cols={3}>
          <Field label="Lead source" required>
            <Select name="leadSource" required value={source} onChange={(e) => setSource(e.target.value)} placeholder="Select…" options={LEAD_SOURCES} />
          </Field>
          {source === "CAMPAIGN" && (
            <Field label="Campaign" required>
              <Select name="campaignId" required defaultValue={v("campaignId")} placeholder="Select campaign…" options={campaigns} />
            </Field>
          )}
          {source === "PARTNER" && (
            <Field label="Partner" required>
              <Select name="sourcePartnerId" required defaultValue={v("sourcePartnerId")} placeholder="Select partner…" options={partners} />
            </Field>
          )}
          {source === "REFERRAL" && (
            <Field label="Referred by">
              <Input name="referredBy" defaultValue={v("referredBy")} placeholder="Name of the person" />
            </Field>
          )}
          {source && (
            <Field label="Source note" hint="Optional: ad name, event, page">
              <Input name="sourceNote" defaultValue={v("sourceNote")} />
            </Field>
          )}
        </FormGrid>
      </fieldset>

      <fieldset>
        <legend className="label-caps mb-3">Contact</legend>
        <FormGrid cols={3}>
          <Field label="Full name (as in passport)" required>
            <Input name="fullName" required defaultValue={v("fullName")} autoComplete="off" />
          </Field>
          <Field label="Phone" required hint="With country code, e.g. +971 50 123 4567">
            <Input name="phone" required type="tel" defaultValue={v("phone")} />
          </Field>
          <Field label="WhatsApp" hint="Leave empty if same as phone">
            <Input name="whatsapp" type="tel" defaultValue={v("whatsapp")} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={v("email")} />
          </Field>
          <Field label="Nationality" required>
            <Input name="nationality" required list="nationalities" defaultValue={v("nationality")} />
            <datalist id="nationalities">{NATIONALITIES.map((n) => <option key={n} value={n} />)}</datalist>
          </Field>
          <Field label="Current location">
            <Input name="currentLocation" defaultValue={v("currentLocation")} placeholder="Dubai, Sharjah, home country…" />
          </Field>
          <Field label="Gender">
            <Select name="gender" defaultValue={v("gender")} placeholder="—" options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
          </Field>
          <Field label="Date of birth">
            <Input name="dateOfBirth" type="date" defaultValue={v("dateOfBirth")} />
          </Field>
        </FormGrid>
      </fieldset>

      <fieldset>
        <legend className="label-caps mb-3">Passport & work</legend>
        <FormGrid cols={4}>
          <Field label="Passport number">
            <Input name="passportNo" defaultValue={v("passportNo")} className="uppercase" />
          </Field>
          <Field label="Passport expiry">
            <Input name="passportExpiry" type="date" defaultValue={v("passportExpiry")} />
          </Field>
          <Field label="Trade / skill">
            <Input name="trade" defaultValue={v("trade")} placeholder="Welder, housekeeping…" />
          </Field>
          <Field label="Experience (years)">
            <Input name="experienceYears" type="number" min={0} max={50} defaultValue={v("experienceYears")} />
          </Field>
        </FormGrid>
      </fieldset>

      <fieldset>
        <legend className="label-caps mb-3">Office</legend>
        <FormGrid cols={3}>
          <Field label="Job order">
            <Select name="jobOrderId" defaultValue={v("jobOrderId")} placeholder="Not decided yet" options={jobs} />
          </Field>
          {canAssign && (
            <Field label="Assigned staff">
              <Select name="assignedToId" defaultValue={v("assignedToId")} placeholder="Nobody yet" options={staff} />
            </Field>
          )}
          {canStatus && (
            <Field label="Status" hint="Normally changes on its own from calls, payments and stages">
              <Select name="status" defaultValue={v("status")} options={CANDIDATE_STATUS} />
            </Field>
          )}
        </FormGrid>
        <Field label="Notes" className="mt-3.5">
          <Textarea name="notes" defaultValue={v("notes")} rows={3} />
        </Field>
      </fieldset>

      <div className="flex items-center gap-4 pt-2 border-t border-rule">
        <Submit>{submitLabel}</Submit>
        {!defaults.fullName && (
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" name="allowDuplicate" value="1" /> Save anyway if the phone or passport already exists
          </label>
        )}
      </div>
    </ActionForm>
  );
}
