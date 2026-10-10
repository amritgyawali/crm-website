"use client";

import { useEffect } from "react";
import { btn } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="max-w-lg py-10">
      <div className="label-caps text-danger">Something went wrong</div>
      <h1 className="font-serif text-[26px] font-semibold mt-1">This page could not load</h1>
      <p className="text-[14px] text-ink-2 mt-2">Nothing was saved or changed. Try again; if it keeps happening, tell the office admin and mention the code below.</p>
      {error.digest && <p className="num text-[12.5px] text-muted mt-3">Code: {error.digest}</p>}
      <button className={`${btn("primary")} mt-5`} onClick={reset}>Try again</button>
    </div>
  );
}
