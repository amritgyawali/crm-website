import { notFound } from "next/navigation";
import { loadReceipt } from "@/lib/receipt-data";
import { Receipt } from "@/components/receipt";
import { PrintBar } from "@/components/print-bar";

export const metadata = { title: "Receipt", robots: { index: false } };

/** Public receipt link sent to the candidate on WhatsApp. The token is random and unguessable. */
export default async function PublicReceipt({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await loadReceipt({ shareToken: token });
  if (!r) notFound();
  return (
    <div className="min-h-screen bg-paper print:bg-white py-6 px-4 print:p-0">
      <PrintBar />
      <Receipt {...r} />
    </div>
  );
}
