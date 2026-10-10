import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { Disclose, Field, Input, PageHeader, Section, Select, Tag, Textarea } from "@/components/ui";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { SettingsTabs } from "../tabs";
import { deleteTemplate, saveTemplate } from "../actions";

export const metadata = { title: "WhatsApp templates" };

const AUD = [{ value: "CANDIDATE", label: "Candidates" }, { value: "PARTNER", label: "Partners" }];

export default async function TemplatesPage() {
  await requirePage("settings.manage");
  const list = await db.messageTemplate.findMany({ orderBy: [{ audience: "asc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="templates" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {list.map((t) => (
            <Section key={t.id} title={t.name} actions={<><Tag>{t.audience === "PARTNER" ? "Partners" : "Candidates"}</Tag><ActionButton action={deleteTemplate.bind(null, t.id)} variant="ghost" confirm="Delete template?">Delete</ActionButton></>}>
              <p className="text-[13.5px] whitespace-pre-line">{t.body}</p>
              <Disclose label="Edit" className="mt-3">
                <ActionForm action={saveTemplate.bind(null, t.id)} reset={false} className="space-y-2 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Name"><Input name="name" defaultValue={t.name} /></Field>
                    <Field label="For"><Select name="audience" defaultValue={t.audience} options={AUD} /></Field>
                  </div>
                  <Field label="Message"><Textarea name="body" rows={4} defaultValue={t.body} /></Field>
                  <Submit size="sm">Save</Submit>
                </ActionForm>
              </Disclose>
            </Section>
          ))}
        </div>
        <div className="space-y-5">
          <Section title="New template">
            <ActionForm action={saveTemplate.bind(null, null)} className="space-y-2.5">
              <Field label="Name"><Input name="name" required /></Field>
              <Field label="For"><Select name="audience" options={AUD} /></Field>
              <Field label="Message"><Textarea name="body" rows={5} required /></Field>
              <Submit size="sm">Add template</Submit>
            </ActionForm>
          </Section>
          <Section title="Fill-in words">
            <p className="text-[12.5px] text-muted mb-2">These are replaced with the record&apos;s details when the message opens in WhatsApp.</p>
            <ul className="text-[12.5px] num space-y-0.5">
              {["{name}", "{fullName}", "{job}", "{balance}", "{amount}", "{installment}", "{dueDate}", "{staff}", "{company}", "{address}", "{contact} (partners)"].map((v) => <li key={v}>{v}</li>)}
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
