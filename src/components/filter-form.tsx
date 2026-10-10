"use client";

import type { ReactNode } from "react";

/** GET form that submits as soon as a select changes. */
export function FilterForm({ children, action }: { children: ReactNode; action?: string }) {
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-2 mb-4"
      onChange={(e) => {
        const t = e.target as HTMLElement;
        if (t.tagName === "SELECT" || (t as HTMLInputElement).type === "date" || (t as HTMLInputElement).type === "month") (e.currentTarget as HTMLFormElement).requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
