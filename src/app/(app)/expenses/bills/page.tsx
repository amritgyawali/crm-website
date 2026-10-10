import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { toDateInput } from "@/lib/dates";
import { BILL_CATEGORIES, FREQUENCIES } from "@/lib/constants";
import { Field, FormGrid, Input, PageHeader, Section, Select } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { BillsTable } from "../bills-table";
import { ExpenseTabs } from "../tabs";
import { saveBill } from "../actions";

export const metadata = { title: "Recurring bills" };

export default async function BillsPage() {
  await requirePage("expenses.manage");
  const [unpaid, paid] = await Promise.all([
    db.bill.findMany({ where: { status: "UNPAID" }, orderBy: { dueDate: "asc" } }),
    db.bill.findMany({ where: { status: "PAID" }, orderBy: { paidOn: "desc" }, take: 40 }),
  ]);
  return (
    <>
      <PageHeader title="Recurring bills" meta="Rent, DEWA, internet, phone, subscriptions and licences. When one is paid, the next is created automatically." />
      <ExpenseTabs active="bills" />
      <div className="space-y-5">
        <Section title="Upcoming & unpaid" flush><BillsTable bills={unpaid} empty="All bills are paid." /></Section>
        <Section title="Add a bill">
          <ActionForm action={saveBill.bind(null, null)} className="space-y-3">
            <FormGrid cols={4}>
              <Field label="Bill name" required><Input name="name" required placeholder="DEWA, office 1204" /></Field>
              <Field label="Category" required><Select name="category" required options={BILL_CATEGORIES} /></Field>
              <Field label="Supplier"><Input name="vendor" /></Field>
              <Field label="Amount (AED)" required><Input name="amount" className="num" required /></Field>
              <Field label="Next due date" required><Input name="dueDate" type="date" required defaultValue={toDateInput(new Date())} /></Field>
              <Field label="Repeats"><Select name="frequency" options={FREQUENCIES} defaultValue="MONTHLY" /></Field>
              <Field label="Remind days before"><Input name="remindDays" type="number" min={0} defaultValue={5} /></Field>
            </FormGrid>
            <Submit>Add bill</Submit>
          </ActionForm>
        </Section>
        <Section title="Recently paid" flush><BillsTable bills={paid} showPaid /></Section>
      </div>
    </>
  );
}
