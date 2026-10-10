import { notFound } from "next/navigation";
import { loadReceipt } from "@/lib/receipt-data";
import { Receipt } from "@/components/receipt";
import { PrintBar } from "@/components/print-bar";
import { d, money } from "@/lib/format";

export const metadata = { title: "Receipt" };

export default async function ReceiptPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadReceipt({ id });
  if (!r) notFound();
  const text = `${r.company.name}\nReceipt ${r.p.receiptNo}\nReceived from ${r.p.candidate.fullName}: ${money(r.p.amount)} on ${d(r.p.date)}.\nBalance: ${money(r.balanceAfter)}.\nView receipt:`;
  return (
    <>
      <PrintBar back={`/candidates/${r.p.candidate.id}`} share={{ phone: r.p.candidate.whatsapp || r.p.candidate.phone, text, path: `/r/${r.p.shareToken}` }} />
      <Receipt {...r} />
    </>
  );
}
