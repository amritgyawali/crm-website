"use client";

import { useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { Field, Input, Select } from "@/components/ui";
import { ATTENDANCE_STATUS } from "@/lib/constants";
import { setAttendance } from "../actions";

export function AttendanceSetter({ staff, today }: { staff: { value: string; label: string }[]; today: string }) {
  const [userId, setUserId] = useState(staff[0]?.value ?? "");
  const [date, setDate] = useState(today);
  return (
    <ActionForm action={(fd) => setAttendance(userId, date, fd)} className="grid gap-2 sm:grid-cols-[1fr_150px_140px_100px_100px_auto] items-end">
      <Field label="Staff"><Select value={userId} onChange={(e) => setUserId(e.target.value)} options={staff} /></Field>
      <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Status"><Select name="status" placeholder="Clear" options={ATTENDANCE_STATUS} defaultValue="PRESENT" /></Field>
      <Field label="In"><Input name="checkIn" type="time" /></Field>
      <Field label="Out"><Input name="checkOut" type="time" /></Field>
      <Submit>Save</Submit>
    </ActionForm>
  );
}
