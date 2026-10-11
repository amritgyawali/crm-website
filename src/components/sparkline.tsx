// 14-day trend line for a figure tile. Hovering a day shows its value.
export function Sparkline({ values, labels, format = (n) => String(n), tone = "accent" }: { values: number[]; labels: string[]; format?: (n: number) => string; tone?: "accent" | "ink" }) {
  const w = 120, h = 28, pad = 2;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const color = tone === "accent" ? "var(--color-accent)" : "var(--color-ink-2)";
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7 mt-1.5 overflow-visible" role="img" aria-label={`Last ${values.length} days: ${values.map(format).join(", ")}`}>
      <polygon points={`${pad},${h - pad} ${line} ${w - pad},${h - pad}`} fill={color} opacity="0.1" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {last && <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />}
      {pts.map(([x], i) => (
        <rect key={i} x={x - step / 2} y={0} width={Math.max(step, 4)} height={h} fill="transparent">
          <title>{`${labels[i]}: ${format(values[i]!)}`}</title>
        </rect>
      ))}
    </svg>
  );
}
