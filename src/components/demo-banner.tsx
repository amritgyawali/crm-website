import Link from "next/link";
import { demoMode } from "@/lib/database-url";

/** A thin strip on every page while the app runs on sample data (no database connected). */
export function DemoBanner() {
  if (!demoMode()) return null;
  return (
    <div role="note" className="no-print bg-warn-tint text-warn text-[12.5px] leading-snug px-4 py-1.5 text-center">
      <strong className="font-semibold">Demo mode:</strong> sample data only. Changes are not kept and reset when the server restarts.{" "}
      <Link href="/setup" className="underline underline-offset-2 whitespace-nowrap">Connect a database</Link>
    </div>
  );
}
