import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md">
        <div className="label-caps">404</div>
        <h1 className="font-serif text-[28px] font-semibold mt-1">This record isn&apos;t here</h1>
        <p className="text-[14px] text-ink-2 mt-2">It may have been deleted, or the link is incomplete. Search for the candidate or partner by name instead.</p>
        <div className="flex gap-4 mt-5 text-[14px]">
          <Link className="link" href="/">Back to Today</Link>
          <Link className="link" href="/candidates">Candidates</Link>
        </div>
      </div>
    </main>
  );
}
