import Link from "next/link";

export function Pager({ page, pages, params, base }: { page: number; pages: number; params: Record<string, string | undefined>; base: string }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    q.set("page", String(p));
    return `${base}?${q}`;
  };
  return (
    <div className="flex items-center justify-between px-4 py-3 text-[13px] border-t border-rule">
      <span className="text-muted">Page {page} of {pages}</span>
      <span className="flex gap-3">
        {page > 1 && <Link className="link" href={href(page - 1)}>Previous</Link>}
        {page < pages && <Link className="link" href={href(page + 1)}>Next</Link>}
      </span>
    </div>
  );
}
