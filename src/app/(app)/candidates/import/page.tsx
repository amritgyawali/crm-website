import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { LEAD_SOURCES } from "@/lib/constants";
import { Field, FormGrid, Input, PageHeader, Section, Select, TableWrap, btn } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { IMPORT_COLUMNS } from "@/lib/import";
import { importCandidates } from "./actions";

export const metadata = { title: "Import candidates" };

export default async function ImportPage() {
  await requirePage("candidate.edit");
  const staff = await db.user.findMany({ where: { active: true, role: { in: ["SALES", "MANAGEMENT", "OPERATIONS"] } }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Import candidates" back={{ href: "/candidates", label: "Candidates" }} meta="Bring in an existing list from Excel or CSV. Duplicates (same phone or passport) are skipped." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Section title="1. Upload the file">
          <ActionForm action={importCandidates} reset={false} inlineSuccess className="space-y-4">
            <Field label="Excel (.xlsx) or CSV file" required><Input name="file" type="file" accept=".xlsx,.csv,text/csv" required /></Field>
            <FormGrid cols={2}>
              <Field label="Lead source when the column is empty" hint="Every candidate must have a source">
                <Select name="defaultSource" placeholder="None (row is rejected)" options={LEAD_SOURCES.filter((s) => s.value !== "CAMPAIGN" && s.value !== "PARTNER")} />
              </Field>
              <Field label="Assign to when no staff is given">
                <Select name="defaultStaff" placeholder="Nobody" options={staff.map((u) => ({ value: u.id, label: u.name }))} />
              </Field>
            </FormGrid>
            <div className="flex flex-wrap gap-2 pt-1">
              <Submit name="mode" value="check" variant="secondary">Check file</Submit>
              <Submit name="mode" value="import">Import</Submit>
            </div>
            <p className="text-[12.5px] text-muted">“Check file” reads everything and lists problems without saving. Fix the rows in Excel and upload again, or import the good rows straight away.</p>
          </ActionForm>
        </Section>
        <Section title="2. Columns" actions={<a className={btn("secondary", "sm")} href="/api/import-template">Download template</a>} flush>
          <TableWrap>
            <table className="grid-table">
              <tbody>
                {IMPORT_COLUMNS.map((c) => (
                  <tr key={c.key}>
                    <td className="font-medium whitespace-nowrap">{c.header}{"required" in c && c.required && <span className="text-danger">*</span>}</td>
                    <td className="text-[12.5px] text-muted">
                      {c.key === "leadSource" && "Campaign, Walk-in, Referral, Partner or Other"}
                      {c.key === "campaign" && "Exact campaign name, when source is Campaign"}
                      {c.key === "partner" && "Exact partner name, when source is Partner"}
                      {c.key === "phone" && "With country code"}
                      {c.key === "passportExpiry" && "2031-05-20 or 20/05/2031"}
                      {c.key === "jobOrder" && "e.g. PL-RRF-2026-114"}
                      {c.key === "staff" && "Staff login email or full name"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Section>
      </div>
    </>
  );
}
