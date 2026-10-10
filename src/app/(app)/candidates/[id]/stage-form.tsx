"use client";

import { useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action";
import { REFUSABLE_STAGES, STAGES, type Stage } from "@/lib/constants";

export function StageForm({ action, suggested, paid, today }: { action: (fd: FormData) => Promise<ActionState>; suggested: Stage; paid: number; today: string }) {
  const [stage, setStage] = useState<Stage>(suggested);
  const [result, setResult] = useState<"DONE" | "REFUSED">("DONE");
  const refusable = REFUSABLE_STAGES.includes(stage);

  return (
    <ActionForm action={action} className="space-y-3">
      <FormGrid cols={3}>
        <Field label="Stage">
          <Select name="stage" value={stage} onChange={(e) => { setStage(e.target.value as Stage); setResult("DONE"); }} options={STAGES} />
        </Field>
        {refusable && (
          <Field label="Decision">
            <Select name="result" value={result} onChange={(e) => setResult(e.target.value as "DONE" | "REFUSED")} options={[{ value: "DONE", label: "Approved" }, { value: "REFUSED", label: "Refused" }]} />
          </Field>
        )}
        <Field label="Date">
          <Input name="date" type="date" defaultValue={today} required />
        </Field>
      </FormGrid>

      {stage === "VFS_BOOKED" && (
        <FormGrid cols={2}>
          <Field label="Appointment date & time">
            <Input name="appointmentAt" type="datetime-local" required />
          </Field>
          <Field label="Location">
            <Input name="location" placeholder="VFS Global, Wafi Mall, Dubai" required />
          </Field>
        </FormGrid>
      )}
      {stage === "FLIGHT_BOOKED" && (
        <FormGrid cols={2}>
          <Field label="Departure date & time">
            <Input name="appointmentAt" type="datetime-local" required />
          </Field>
          <Field label="Flight details">
            <Input name="flightDetails" placeholder="Airline, flight no., DXB → destination, PNR" required />
          </Field>
        </FormGrid>
      )}
      {result === "REFUSED" && (
        <div className="p-3 bg-danger-tint border border-danger/20 rounded-[3px] space-y-3">
          <p className="text-[13px] text-danger">A refusal closes the case and opens a refund record for management approval.</p>
          <FormGrid cols={2}>
            <Field label="Refusal reason" required>
              <Input name="refusalReason" required />
            </Field>
            <Field label="Refund amount as per policy" hint={`Paid so far: AED ${paid.toFixed(2)}. Can be corrected before approval.`}>
              <Input name="refundAmount" inputMode="decimal" className="num" defaultValue={paid ? String(paid) : "0"} />
            </Field>
          </FormGrid>
        </div>
      )}
      <Field label="Note">
        <Textarea name="note" rows={2} placeholder="What happened, who was contacted…" />
      </Field>
      <Submit variant={result === "REFUSED" ? "danger" : "primary"}>{result === "REFUSED" ? "Record refusal and close case" : "Save stage"}</Submit>
    </ActionForm>
  );
}
