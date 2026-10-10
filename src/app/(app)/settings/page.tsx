import { readdir, stat } from "fs/promises";
import path from "path";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { BACKUP_DIR } from "@/lib/backup";
import { dt } from "@/lib/format";
import { Field, FormGrid, Input, PageHeader, Section, Textarea, btn } from "@/components/ui";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { SettingsTabs } from "./tabs";
import { runBackup, saveSettings } from "./actions";

export const metadata = { title: "Settings" };

async function backups() {
  try {
    const files = (await readdir(BACKUP_DIR)).filter((f) => f.endsWith(".db")).sort().reverse().slice(0, 5);
    return Promise.all(files.map(async (f) => ({ f, s: await stat(path.join(BACKUP_DIR, f)) })));
  } catch {
    return [];
  }
}

export default async function SettingsPage() {
  const user = await requirePage("settings.manage");
  const s = await getSettings();
  const list = await backups();
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="general" />
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
            <p className="text-[13px] text-ink-2">Run <code className="num bg-well px-1">npm run backup</code> every night from the server&apos;s scheduler (cron) to keep 30 days of copies. You can also make one now.</p>
            <div className="flex gap-2 mt-3">
              <ActionButton action={runBackup} size="md">Back up now</ActionButton>
              <a className={btn("secondary")} href="/api/backup">Download a copy</a>
            </div>
            <div className="mt-4">
              <div className="label-caps mb-1">Latest on server</div>
              {list.length === 0 ? <p className="text-[13px] text-muted">No backups yet.</p> : (
                <ul className="text-[12.5px] space-y-1">
                  {list.map((b) => <li key={b.f} className="flex justify-between"><span className="num">{b.f}</span><span className="text-muted">{dt(b.s.mtime)}</span></li>)}
                </ul>
              )}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}
