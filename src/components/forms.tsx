"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/action";
import { btn, cx } from "./ui";

const PendingCtx = createContext(false);

export function ActionForm({
  action, children, className, reset = true, onDone, showMessage = true,
}: {
  action: (fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  reset?: boolean;
  onDone?: (s: ActionState) => void;
  showMessage?: boolean;
}) {
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const r = await action(fd);
          setState(r);
          if (r?.ok) {
            if (reset) form.reset();
            onDone?.(r);
            router.refresh();
          }
        });
      }}
    >
      <PendingCtx.Provider value={pending}>
        {children}
        {showMessage && <FormMessage state={state} />}
      </PendingCtx.Provider>
    </form>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state || (!state.error && !state.message)) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={cx("mt-3 text-[13px] px-3 py-2 rounded-[3px] border", state.error ? "text-danger bg-danger-tint border-danger/20" : "text-accent bg-accent-tint border-accent/20")}
    >
      {state.error ?? state.message}
    </p>
  );
}

export function Submit({
  children, variant = "primary", size = "md", className, name, value,
}: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "quiet"; size?: "sm" | "md"; className?: string; name?: string; value?: string }) {
  const pending = useContext(PendingCtx);
  return (
    <button type="submit" disabled={pending} name={name} value={value} className={cx(btn(variant, size), className)}>
      {pending ? "Saving…" : children}
    </button>
  );
}

/** A single button that runs a server action, optionally after a confirm prompt. */
export function ActionButton({
  action, children, confirm, variant = "secondary", size = "sm", className, prompt,
}: {
  action: (input?: string) => Promise<ActionState>;
  children: ReactNode;
  confirm?: string;
  prompt?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "quiet";
  size?: "sm" | "md";
  className?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      className={cx(btn(variant, size), className)}
      onClick={() => {
        let input: string | undefined;
        if (prompt) {
          const v = window.prompt(prompt);
          if (v === null) return;
          input = v;
        } else if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const r = await action(input);
          if (r?.error) window.alert(r.error);
          router.refresh();
        });
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
