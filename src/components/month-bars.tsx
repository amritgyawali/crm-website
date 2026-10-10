// Paired monthly bars (e.g. income vs costs). Colours validated for colour-blind separation.
const A = "#1f7a55";
const B = "#c4793a";
const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

export function MonthBars({ data, aLabel, bLabel, height = 180, showNet = true }: { data: { label: string; a: number; b: number }[]; aLabel: string; bLabel: string; height?: number; showNet?: boolean }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  return (
    <figure>
      <div className="flex gap-4 text-[12.5px] text-ink-2 mb-3" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: A }} />{aLabel}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: B }} />{bLabel}</span>
      </div>
      <div className="relative" style={{ height }}>
        {[0.5, 1].map((t) => (
          <div key={t} className="absolute left-0 right-0 border-t border-dashed border-rule" style={{ bottom: `${t * 100}%` }}>
            <span className="absolute -top-2 right-0 text-[10.5px] text-muted num bg-sheet pl-1">{fmt(max * t)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[6%] pr-12 border-b border-ink-2">
          {data.map((d) => (
            <div key={d.label} className="group relative flex-1 h-full flex items-end justify-center gap-[2px]">
              <div className="w-[38%] max-w-[26px] rounded-t-[4px]" style={{ height: `${(d.a / max) * 100}%`, background: A }} />
              <div className="w-[38%] max-w-[26px] rounded-t-[4px]" style={{ height: `${(d.b / max) * 100}%`, background: B }} />
              <div className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-ink text-paper text-[12px] px-2 py-1.5 rounded-[3px] whitespace-nowrap">
                <div className="font-medium">{d.label}</div>
                <div className="num">{aLabel} {fmt(d.a)}</div>
                <div className="num">{bLabel} {fmt(d.b)}</div>
                {showNet && <div className="num">Net {fmt(d.a - d.b)}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-[6%] pr-12 mt-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center text-[11.5px] text-muted leading-tight">
            {d.label}
            {showNet ? (
              <div className={`num ${d.a - d.b < 0 ? "text-danger" : "text-ink-2"}`}>{d.a - d.b >= 0 ? "+" : "−"}{fmt(Math.abs(d.a - d.b))}</div>
            ) : (
              <div className="num text-ink-2">{fmt(d.a)} / {fmt(d.b)}</div>
            )}
          </div>
        ))}
      </div>
      <figcaption className="sr-only">{data.map((d) => `${d.label}: ${aLabel} ${fmt(d.a)}, ${bLabel} ${fmt(d.b)}`).join("; ")}</figcaption>
    </figure>
  );
}
