import { BILL_CATEGORY_LABEL, FREQUENCY_LABEL, PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { d, relDays } from "@/lib/format";
import { toDateInput } from "@/lib/dates";
import { Empty, Field, Input, Money, Select, TableWrap, Tag, cx } from "@/components/ui";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { deleteBill, payBill } from "./actions";

type Bill = { id: string; name: string; category: string; vendor: string | null; amount: number; dueDate: Date; frequency: string; remindDays: number; status: string; paidOn: Date | null; paidMethod: string | null; paidRef: string | null };

export function BillsTable({ bills, empty = "No bills.", showPaid }: { bills: Bill[]; empty?: string; showPaid?: boolean }) {
  if (!bills.length) return <Empty>{empty}</Empty>;
  const now = new Date();
  return (
    <TableWrap>
      <table className="grid-table">
        <thead><tr><th>Bill</th><th>Category</th><th>Repeats</th><th>Due</th><th className="r">Amount</th><th>{showPaid ? "Paid" : ""}</th></tr></thead>
        <tbody>
          {bills.map((b) => {
            const late = b.status === "UNPAID" && b.dueDate < now;
            return (
              <tr key={b.id}>
                <td className="font-medium">{b.name}{b.vendor && <div className="text-[12px] text-muted font-normal">{b.vendor}</div>}</td>
                <td className="text-[13px]">{BILL_CATEGORY_LABEL[b.category as keyof typeof BILL_CATEGORY_LABEL]}</td>
                <td className="text-[13px]">{FREQUENCY_LABEL[b.frequency as keyof typeof FREQUENCY_LABEL]}</td>
                <td className={cx("whitespace-nowrap", late && "text-danger font-medium")}>{d(b.dueDate)}{b.status === "UNPAID" && <div className="text-[12px] font-normal">{relDays(b.dueDate)}</div>}</td>
                <td className="r"><Money v={b.amount} /></td>
                <td className="whitespace-nowrap">
                  {b.status === "PAID" ? (
                    <span className="text-[13px]"><Tag tone="green">Paid</Tag> {d(b.paidOn, "d MMM")}<span className="text-muted"> · {b.paidMethod ? PAYMENT_METHOD_LABEL[b.paidMethod as keyof typeof PAYMENT_METHOD_LABEL] : ""}</span></span>
                  ) : (
                    <details className="relative inline-block">
                      <summary className="list-none cursor-pointer link text-[13px] [&::-webkit-details-marker]:hidden">Mark paid</summary>
                      <div className="absolute right-0 z-10 mt-1 w-[300px] bg-sheet border border-rule-2 p-3 shadow-[0_6px_18px_rgba(0,0,0,.08)]">
                        <ActionForm action={payBill.bind(null, b.id)} className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Paid on"><Input name="paidOn" type="date" defaultValue={toDateInput(now)} /></Field>
                            <Field label="Amount"><Input name="amount" defaultValue={String(b.amount)} className="num" /></Field>
                          </div>
                          <Field label="Method"><Select name="method" options={PAYMENT_METHODS} defaultValue="BANK_TRANSFER" /></Field>
                          <Field label="Reference"><Input name="paidRef" /></Field>
                          <div className="flex justify-between items-center">
                            <Submit size="sm">Save</Submit>
                            <ActionButton action={deleteBill.bind(null, b.id)} variant="ghost" confirm="Delete this bill?">Delete</ActionButton>
                          </div>
                        </ActionForm>
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot><tr><td colSpan={4}>{bills.length} bills</td><td className="r"><Money v={bills.reduce((s, b) => s + b.amount, 0)} /></td><td></td></tr></tfoot>
      </table>
    </TableWrap>
  );
}
