import Link from "next/link";
import { setupStatus } from "@/lib/setup-status";
import { btn, cx } from "@/components/ui";

export const metadata = { title: "Finish setting up" };
export const dynamic = "force-dynamic";

// Public page (see middleware). It only says what is missing, never any values,
// and once everything is in place it shows nothing but a link to sign in.
export default async function SetupPage() {
  const { ready, demo, steps } = await setupStatus();

  if (ready) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-sheet">
        <div className="max-w-md">
          <h1 className="font-serif text-[26px] font-semibold">Ready</h1>
          <p className="text-[14px] text-ink-2 mt-2">The system is set up.</p>
          <Link href="/login" className={cx(btn("primary"), "mt-5")}>Go to sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex justify-center p-6 sm:py-16 bg-sheet">
      <div className="w-full max-w-[640px]">
        {demo ? (
          <>
            <div className="label-caps text-warn">Demo mode</div>
            <h1 className="font-serif text-[28px] leading-[1.15] font-semibold mt-1">Running on sample data</h1>
            <p className="text-[14px] text-ink-2 mt-2">
              No database is connected, so the site runs on built-in sample data. You can sign in and try everything, but
              changes are not kept: they reset whenever the server restarts. To keep real records, do the items marked below.
              The site leaves demo mode by itself on the next deploy after the database is connected.
            </p>
          </>
        ) : (
          <>
            <div className="label-caps text-warn">Not ready yet</div>
            <h1 className="font-serif text-[28px] leading-[1.15] font-semibold mt-1">Finish setting up</h1>
            <p className="text-[14px] text-ink-2 mt-2">
              The site is deployed, but it needs the items marked below before anyone can sign in. Each one says what to do.
              Reload this page after each change.
            </p>
          </>
        )}
        <ol className="mt-6 border border-rule rounded-[3px] divide-y divide-rule bg-paper">
          {steps.map((s) => (
            <li key={s.title} className="p-4 flex gap-3">
              <span
                aria-hidden
                className={cx(
                  "mt-0.5 shrink-0 w-5 h-5 rounded-full grid place-items-center text-[12px] font-semibold",
                  s.ok ? "bg-accent-tint text-accent" : "bg-danger-tint text-danger",
                )}
              >
                {s.ok ? "✓" : "!"}
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold">
                  {s.title}
                  <span className="sr-only">{s.ok ? " (done)" : " (to do)"}</span>
                </div>
                <p className={cx("text-[13.5px] mt-0.5 break-words", s.ok ? "text-muted" : "text-ink-2")}>{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 mt-5">
          {demo ? (
            <Link href="/login" className={btn("primary")}>Sign in to the demo</Link>
          ) : (
            <>
              <Link href="/setup" className={btn("primary")}>Check again</Link>
              <Link href="/login" className={btn("secondary")}>Sign-in page</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
