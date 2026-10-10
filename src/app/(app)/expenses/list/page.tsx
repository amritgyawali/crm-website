import type { Prisma } from "@prisma/client";
import { endOfMonth, startOfMonth } from "date-fns";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { monthFromKey, monthKey, toDateInput } from "@/lib/dates";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { d } from "@/lib/format";
import { Empty, Field, FormGrid, Input, Money, PageHeader, Section, Select, TableWrap, Tag, btn } from "@/components/ui";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { FilterForm } from "@/components/filter-form";
import { ExpenseTabs } from "../tabs";
import { decideExpense, deleteExpense, saveExpense } from "../actions";

export const metadata = { title: "Expenses" };

export default async function ExpenseList({ searchParams }: { searchParams: Promise<{ month?: string; category?: string; status?: string }> }) {
  const user = await requirePage("expenses.manage");
  const sp = await searchParams;
  const mk = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : monthKey();
  const m = monthFromKey(mk);
  const where: Prisma.ExpenseWhereInput = sp.status === "PENDING" ? { status: "PENDING" } : { date: { gte: startOfMonth(m), lte: endOfMonth(m) } };
  if (sp.category) where.category = sp.category;
  if (sp.status && sp.status !== "PENDING") where.status = sp.status;
  const [rows, campaigns] = await Promise.all([
    db.expense.findMany({ where, orderBy: { date: "desc" }, include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } } }),
    db.campaign.findMany({ orderBy: { startDate: "desc" }, take: 20 }),
  ]);
  const approver = can(user.role, "expenses.approve");

  return (
    <>
      <PageHeader title="Expenses" meta="One-time spending with the bill or receipt attached. Finance enters, management approves." />
      <ExpenseTabs active="list" />
      <Section title="Add expense" className="mb-5">
        <ActionForm action={saveExpense} className="space-y-3">
          <FormGrid cols={4}>
            <Field label="Date" required><Input name="date" type="date" required defaultValue={toDateInput(new Date())} /></Field>
            <Field label="Category" required><Select name="category" required options={EXPENSE_CATEGORIES} /></Field>
            <Field label="Amount (AED)" required><Input name="amount" className="num" required /></Field>
            <Field label="Paid by" required><Input name="paidBy" required placeholder="Petty cash, company card, name" /></Field>
            <Field label="Method"><Select name="method" options={PAYMENT_METHODS} defaultValue="CASH" /></Field>
            <Field label="Campaign (for boosting)"><Select name="campaignId" placeholder="—" options={campaigns.map((c) => ({ value: c.id, label: c.name }))} /></Field>
            <Field label="Bill / receipt (photo or PDF)" className="sm:col-span-2"><Input name="file" type="file" accept=".pdf,image/*" /></Field>
          </FormGrid>
          <Field label="Note"><Input name="note" placeholder="What it was for" /></Field>
          <Submit>Save expense</Submit>
        </ActionForm>
      </Section>

      <FilterForm>
        <input type="month" name="month" defaultValue={mk} className="control !w-[170px]" />
        <Select name="category" defaultValue={sp.category ?? ""} placeholder="All categories" options={EXPENSE_CATEGORIES} className="!w-[200px]" />
        <Select name="status" defaultValue={sp.status ?? ""} placeholder="Any status" options={[{ value: "PENDING", label: "Waiting approval (all months)" }, { value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }]} className="!w-[230px]" />
        <a className={btn("secondary")} href={`/api/export/expenses?month=${mk}`}>Export month</a>
      </FilterForm>
      <Section flush>
        {rows.length === 0 ? <Empty>No expenses.</Empty> : (
          <TableWrap>
            <table className="grid-table">
              <thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Paid by</th><th>Receipt</th><th>Status</th><th className="r">Amount</th><th></th></tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{d(e.date)}</td>
                    <td className="text-[13px]">{EXPENSE_CATEGORY_LABEL[e.category as keyof typeof EXPENSE_CATEGORY_LABEL]}</td>
                    <td className="text-[13px]">{e.note ?? "—"}<div className="text-[12px] text-muted">by {e.createdBy.name}</div></td>
                    <td className="text-[13px]">{e.paidBy}<div className="text-[12px] text-muted">{PAYMENT_METHOD_LABEL[e.method as keyof typeof PAYMENT_METHOD_LABEL]}</div></td>
                    <td className="text-[13px]">{e.fileUrl ? <a className="link" href={e.fileUrl} target="_blank" rel="noreferrer">View</a> : <span className="text-warn">missing</span>}</td>
                    <td>{e.status === "APPROVED" ? <Tag tone="green">Approved</Tag> : e.status === "PENDING" ? <Tag tone="amber">Waiting</Tag> : <Tag tone="faint">Rejected</Tag>}{e.approvedBy && e.status !== "PENDING" && <div className="text-[12px] text-muted">{e.approvedBy.name}</div>}</td>
                    <td className="r"><Money v={e.amount} /></td>
                    <td className="whitespace-nowrap text-right">
                      {e.status === "PENDING" && approver && (
                        <span className="inline-flex gap-1 mr-1">
                          <ActionButton action={decideExpense.bind(null, e.id, "APPROVED")} variant="primary">Approve</ActionButton>
                          <ActionButton action={decideExpense.bind(null, e.id, "REJECTED")}>Reject</ActionButton>
                        </span>
                      )}
                      <ActionButton action={deleteExpense.bind(null, e.id)} variant="ghost" confirm="Delete this expense?">Delete</ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={6}>Total {sp.status === "PENDING" ? "waiting" : d(m, "MMMM")}</td><td className="r"><Money v={rows.filter((e) => e.status !== "REJECTED").reduce((s, e) => s + e.amount, 0)} /></td><td></td></tr></tfoot>
            </table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}
