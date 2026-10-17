import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Field, FormGrid, Input, PageHeader, Section, Textarea } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { SettingsTabs } from "./tabs";
import { setupChecks } from "@/lib/setup-checks";
import { cx } from "@/components/ui";
import { saveSettings } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePage("settings.manage");
  const s = await getSettings();
  const checks = await setupChecks();
  const problems = checks.filter((c) => !c.ok && c.level !== "info").length;
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="general" />
      <Section title="Setup checks" note={problems ? `${problems} to sort out` : "all good"} className="mb-5" flush>
        <ul className="divide-y divide-rule">
          {checks.map((c) => (
            <li key={c.title} className="px-4 py-2.5 flex items-start gap-3 text-[13px]">
              <span className={cx("mt-1.5 w-2 h-2 rounded-full shrink-0", c.ok ? "bg-accent" : c.level === "red" ? "bg-danger" : c.level === "amber" ? "bg-warn" : "bg-rule-2")} aria-hidden />
              <span className="font-medium w-[220px] shrink-0">{c.title}</span>
              <span className={cx(!c.ok && c.level === "red" ? "text-danger" : !c.ok && c.level === "amber" ? "text-warn" : "text-muted")}>{c.detail}</span>
            </li>
          ))}
        </ul>
      </Section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ActionForm action={saveSettings} reset={false} className="space-y-5">
          <Section title="Company (printed on receipts)">
            <FormGrid cols={2}>
              <Field label="Company name"><Input name="companyName" defaultValue={s.companyName} /></Field>
              <Field label="Phone"><Input name="companyPhone" defaultValue={s.companyPhone} /></Field>
              <Field label="Address" className="sm:col-span-2"><Input name="companyAddress" defaultValue={s.companyAddress} /></Field>
              <Field label="Email"><Input name="companyEmail" defaultValue={s.companyEmail} /></Field>
              <Field label="TRN (VAT)"><Input name="companyTrn" defaultValue={s.companyTrn} /></Field>
              <Field label="Receipt number prefix" hint="Receipts are numbered PREFIX-YEAR-00001"><Input name="receiptPrefix" defaultValue={s.receiptPrefix} className="uppercase" /></Field>
            </FormGrid>
          </Section>
          <Section title="Reminders & alerts">
            <FormGrid cols={3}>
              <Field label="Lead not contacted after (days)"><Input name="leadNoContactDays" type="number" min={1} defaultValue={s.leadNoContactDays} /></Field>
              <Field label="Payment reminder (days before due)"><Input name="paymentReminderDays" type="number" min={0} defaultValue={s.paymentReminderDays} /></Field>
              <Field label="Passport alert (months)"><Input name="passportAlertMonths" type="number" min={1} defaultValue={s.passportAlertMonths} /></Field>
              <Field label="Post-arrival check-in (days)"><Input name="postArrivalCheckDays" type="number" min={1} defaultValue={s.postArrivalCheckDays} /></Field>
              <Field label="Stage-linked installment due after (days)"><Input name="stageDueDays" type="number" min={0} defaultValue={s.stageDueDays} /></Field>
            </FormGrid>
          </Section>
          <Section title="Refund policy (shown when closing a case)">
            <Textarea name="refundPolicy" rows={4} defaultValue={s.refundPolicy} />
          </Section>
          <Submit>Save settings</Submit>
        </ActionForm>

        {can(user.role, "backup.download") && (
          <Section title="Backup">
            <p className="text-[13px] text-ink-2">
              All records and uploaded files live in your PostgreSQL database, so backups are done by the database host
              (Neon, Supabase, …). Check in its dashboard that automatic backups or point-in-time restore are switched on.
            </p>
            <p className="text-[13px] text-muted mt-2">Spreadsheet exports of the main lists are under Reports &amp; export.</p>
          </Section>
        )}
      </div>
    </>
  );
}
