import { requireUser } from "@/lib/auth";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="min-h-screen bg-paper print:bg-white py-6 px-4 print:p-0">{children}</div>;
}
