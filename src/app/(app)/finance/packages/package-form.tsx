"use client";

import { useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action";
import { COUNTRIES_DEST, STAGES } from "@/lib/constants";

type Step = { label: string; amount: string; when: string; days: string };
const WHEN = [{ value: "DAYS", label: "Days after enrolment" }, ...STAGES.map((s) => ({ value: s.value, label: `At: ${s.short}` }))];

export function PackageForm({
  action, jobs, defaults,
}: {
  action: (fd: FormData) => Promise<ActionState>;
  jobs: { value: string; label: string }[];
  defaults?: { name: string; jobOrderId: string; country: string; refundPolicy: string; steps: Step[] };
}) {
  const [steps, setSteps] = useState<Step[]>(defaults?.steps ?? [
    { label: "First installment (enrolment)", amount: "", when: "DAYS", days: "0" },
    { label: "After work permit approval", amount: "", when: "WP_APPROVED", days: "" },
    { label: "After visa approval", amount: "", when: "VISA_APPROVED", days: "" },
  ]);
  const total = steps.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const set = (i: number, k: keyof Step, v: string) => setSteps((all) => all.map((s, j) => (j === i ? { ...s, [k]: v } : s)));

  return (
    <ActionForm action={action} reset={!defaults} className="space-y-4">
      <FormGrid cols={3}>
        <Field label="Package name" required><Input name="name" required defaultValue={defaults?.name} placeholder="Warehouse · Poland 2026" /></Field>
        <Field label="Job order"><Select name="jobOrderId" defaultValue={defaults?.jobOrderId ?? ""} placeholder="Any job in the country" options={jobs} /></Field>
        <Field label="Destination country" hint="Taken from the job order if left empty">
          <Input name="country" list="dest-countries" defaultValue={defaults?.country} />
          <datalist id="dest-countries">{COUNTRIES_DEST.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
      </FormGrid>
      <div>
        <div className="label-caps mb-2">Installments</div>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="grid gap-2 grid-cols-[24px_1fr_110px_190px_80px_auto] items-center">
              <span className="num text-muted text-[12px]">{i + 1}</span>
              <input name="stepLabel" className="control" value={s.label} onChange={(e) => set(i, "label", e.target.value)} placeholder="Description" />
              <input name="stepAmount" className="control num" value={s.amount} onChange={(e) => set(i, "amount", e.target.value)} placeholder="Amount" inputMode="decimal" />
              <select name="stepWhen" className="control" value={s.when} onChange={(e) => set(i, "when", e.target.value)}>
                {WHEN.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
              <input name="stepDays" className="control num" value={s.days} onChange={(e) => set(i, "days", e.target.value)} placeholder="days" disabled={s.when !== "DAYS"} />
              <button type="button" className="text-[12px] text-muted hover:text-danger" onClick={() => setSteps((all) => all.filter((_, j) => j !== i))}>remove</button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <button type="button" className="link text-[13px]" onClick={() => setSteps((all) => [...all, { label: "", amount: "", when: "DAYS", days: "30" }])}>+ Add installment</button>
          <span className="text-[13px]">Total <span className="num font-medium">AED {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></span>
        </div>
      </div>
      <Field label="Refund policy for this package"><Textarea name="refundPolicy" rows={2} defaultValue={defaults?.refundPolicy} /></Field>
      <Submit>{defaults ? "Save package" : "Create package"}</Submit>
    </ActionForm>
  );
}
