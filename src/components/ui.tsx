import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | number | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------- buttons

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
const BTN: Record<Variant, string> = {
  primary: "bg-accent text-on-accent border-accent hover:bg-accent-2 hover:border-accent-2",
  secondary: "bg-field text-ink border-rule-2 hover:border-ink-2",
  ghost: "bg-transparent text-ink border-transparent hover:bg-well",
  danger: "bg-field text-danger border-danger/40 hover:bg-danger-tint",
  quiet: "bg-well text-ink border-transparent hover:bg-rule",
};
export function btn(variant: Variant = "secondary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1.5 border rounded-[3px] font-medium whitespace-nowrap no-underline transition-[color,background-color,border-color,transform] active:translate-y-px disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
    size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-[34px] px-3.5 text-[13.5px]",
    BTN[variant],
  );
}
export function Button({ variant = "secondary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button className={cx(btn(variant, size), className)} {...p} />;
}
export function LinkButton({ variant = "secondary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link className={cx(btn(variant, size), className)} {...p} />;
}

// ---------------------------------------------------------------- tags

export type Tone = "plain" | "green" | "red" | "amber" | "blue" | "ink" | "faint";
const TAG: Record<Tone, string> = {
  plain: "bg-well text-ink-2",
  green: "bg-accent-tint text-accent",
  red: "bg-danger-tint text-danger",
  amber: "bg-warn-tint text-warn",
  blue: "bg-info-tint text-info",
  ink: "bg-ink text-paper",
  faint: "bg-transparent text-muted border border-rule-2",
};
export function Tag({ tone = "plain", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center h-[20px] px-1.5 rounded-[2px] text-[11.5px] font-medium whitespace-nowrap", TAG[tone], className)}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- page structure

export function PageHeader({ title, meta, actions, back }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="text-[12.5px] text-muted hover:text-ink no-underline">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mt-1">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] leading-[1.15] font-semibold tracking-[-0.01em]">{title}</h1>
          {meta && <div className="mt-1.5 text-[13px] text-muted flex flex-wrap gap-x-3 gap-y-1 items-center">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Section({
  title, actions, children, className, flush, note, id,
}: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean; note?: ReactNode; id?: string }) {
  return (
    <section id={id} className={cx("bg-sheet border border-rule rounded-[3px] scroll-mt-32", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-4 h-11 border-b border-rule">
          <h2 className="text-[13.5px] font-semibold flex items-center gap-2 min-w-0">{title}{note && <span className="font-normal text-muted text-[12.5px] truncate">{note}</span>}</h2>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

/** Horizontally scrollable wrapper for wide tables. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-[13px] text-muted">{children}</p>;
}

export function Figure({
  label, value, sub, tone, href, chart,
}: { label: string; value: ReactNode; sub?: ReactNode; tone?: "red" | "green" | "amber"; href?: string; chart?: ReactNode }) {
  const body = (
    <>
      <div className="label-caps">{label}</div>
      <div className={cx("num text-[22px] leading-tight mt-1 font-medium", tone === "red" && "text-danger", tone === "green" && "text-accent", tone === "amber" && "text-warn")}>{value}</div>
      {sub && <div className="text-[12.5px] text-muted mt-0.5">{sub}</div>}
      {chart}
    </>
  );
  const cls = "block px-4 py-3 border-rule no-underline";
  return href ? (
    <Link href={href} className={cx(cls, "hover:bg-well/60")}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Row of figures separated by rules, like the totals line of a ledger. */
export function Figures({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 | 6 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4", 5: "sm:grid-cols-3 lg:grid-cols-5", 6: "sm:grid-cols-3 lg:grid-cols-6" }[cols];
  return (
    <div className={cx("grid grid-cols-2 bg-sheet border border-rule rounded-[3px] divide-rule [&>*]:border-b [&>*]:border-r", c)}>
      {children}
    </div>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; count?: number; key: string }[]; active: string }) {
  return (
    <nav className="flex gap-0 border-b border-rule-2 mb-5 overflow-x-auto">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cx(
            "px-3 pb-2 pt-1 -mb-px border-b-2 text-[13.5px] no-underline whitespace-nowrap",
            t.key === active ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="num ml-1.5 text-[12px] text-muted">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function KV({ items, cols = 1 }: { items: [string, ReactNode][]; cols?: 1 | 2 }) {
  return (
    <dl className={cx("grid gap-x-6", cols === 2 ? "sm:grid-cols-2" : "")}>
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-1.5 border-b border-dashed border-rule last:border-0">
          <dt className="text-muted text-[13px] shrink-0">{k}</dt>
          <dd className="text-right text-[13.5px] min-w-0 break-words">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------- form bits

export function Field({ label, hint, children, required, className }: { label: string; hint?: ReactNode; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="block text-[12.5px] font-medium text-ink-2 mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[12px] text-muted mt-1">{hint}</span>}
    </label>
  );
}

export function Input(p: ComponentProps<"input">) {
  return <input {...p} className={cx("control", p.className)} />;
}
export function Textarea(p: ComponentProps<"textarea">) {
  return <textarea {...p} className={cx("control", p.className)} />;
}
export function Select({ options, placeholder, ...p }: ComponentProps<"select"> & { options: readonly { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select {...p} className={cx("control", p.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 | 4 }) {
  const c = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return <div className={cx("grid gap-x-4 gap-y-3.5", c)}>{children}</div>;
}

export function Money({ v, className, zero = "0.00" }: { v: number; className?: string; zero?: string }) {
  const n = Math.round(v * 100) / 100;
  return (
    <span className={cx("num", className)}>
      {n === 0 ? zero : new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}
    </span>
  );
}

/** Thin horizontal bar used for progress & simple comparisons. */
export function Bar({ value, max, tone = "ink" }: { value: number; max: number; tone?: "ink" | "green" | "red" | "amber" }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const c = { ink: "bg-ink", green: "bg-accent", red: "bg-danger", amber: "bg-warn" }[tone];
  return (
    <div className="h-[6px] bg-well rounded-[1px] overflow-hidden">
      <div className={cx("h-full", c)} style={{ width: `${w}%` }} />
    </div>
  );
}

export { Disclose } from "./disclose";

export function Notice({ tone = "amber", children }: { tone?: "amber" | "red" | "green" | "blue"; children: ReactNode }) {
  const c = {
    amber: "bg-warn-tint text-warn border-warn/25",
    red: "bg-danger-tint text-danger border-danger/25",
    green: "bg-accent-tint text-accent border-accent/25",
    blue: "bg-info-tint text-info border-info/25",
  }[tone];
  return <div className={cx("px-3 py-2 border rounded-[3px] text-[13px]", c)}>{children}</div>;
}
