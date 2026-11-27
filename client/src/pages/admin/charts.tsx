import { useId, useMemo, useRef, useState } from 'react';
import type { DayCount, LabelCount } from '@/api/admin';
import { cn } from '@/lib/utils';

/* Small, dependency-free charts. One ink colour for data, brand blue only for the highlighted point. */

const INK = '#111111';
const BLUE = '#0046FF';

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Daily counts as a line with a soft fill. Hover or focus shows the exact day. */
export function TrendChart({ data, height = 180, label }: { data: DayCount[]; height?: number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gradId = useId();
  const W = 600;
  const H = height;
  const pad = { top: 12, right: 8, bottom: 22, left: 28 };

  const { points, max, ticks } = useMemo(() => {
    const top = Math.max(1, ...data.map((d) => d.count));
    // Round the top up to a friendly number so gridlines land on whole values
    const step = Math.max(1, Math.ceil(top / 3));
    const max = step * 3;
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;
    const points = data.map((d, i) => ({
      x: pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
      y: pad.top + innerH - (d.count / max) * innerH,
      ...d,
    }));
    return { points, max, ticks: [0, step, step * 2, max] };
  }, [data, H, pad.left, pad.right, pad.top, pad.bottom]);

  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.count, 0);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const base = H - pad.bottom;
  const area = `${line} L${points[points.length - 1].x},${base} L${points[0].x},${base} Z`;
  const yFor = (v: number) => pad.top + (H - pad.top - pad.bottom) * (1 - v / max);
  const labelEvery = Math.ceil(data.length / 6);

  const onMove = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(points[best].x - x)) best = i;
    });
    setHover(best);
  };
  const active = hover != null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none select-none"
        role="img"
        aria-label={`${label}: ${total} in ${data.length} days`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={INK} stopOpacity="0.10" />
            <stop offset="100%" stopColor={INK} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={yFor(t)} y2={yFor(t)} stroke="#000" strokeOpacity={t === 0 ? 0.12 : 0.05} />
            <text x={pad.left - 6} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#8a8a93">
              {t}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.date} x={p.x} y={H - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize="10" fill="#8a8a93">
              {shortDate(p.date)}
            </text>
          ) : null
        )}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={INK} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {active && (
          <>
            <line x1={active.x} x2={active.x} y1={pad.top} y2={base} stroke="#000" strokeOpacity="0.15" strokeDasharray="3 3" />
            <circle cx={active.x} cy={active.y} r="4" fill={BLUE} stroke="#fff" strokeWidth="2" />
          </>
        )}
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[11.5px] text-white shadow-lg"
          style={{ left: `${Math.min(88, Math.max(12, (active.x / W) * 100))}%` }}
        >
          <span className="font-semibold tabular-nums">{active.count}</span> · {shortDate(active.date)}
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars, label left and value right */
export function BarList({ data, empty = 'No data yet', format }: { data: LabelCount[]; empty?: string; format?: (label: string) => string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length || data.every((d) => d.count === 0)) return <p className="py-6 text-center text-[13px] text-muted">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-[13px]">
          <span className="truncate capitalize">{format ? format(d.label) : d.label}</span>
          <span className="tabular-nums text-muted">{d.count.toLocaleString('en-IN')}</span>
          <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
            <span className="block h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${(d.count / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Parts of a whole as one stacked bar with a legend (reads better than a pie at this size) */
export function SplitBar({ data, className }: { data: LabelCount[]; className?: string }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const shades = [INK, '#6b6b73', '#b9b9c0', '#e2e2e6'];
  return (
    <div className={className}>
      <div className="flex h-3 overflow-hidden rounded-full bg-black/[0.05]" role="img" aria-label={data.map((d) => `${d.label} ${d.count}`).join(', ')}>
        {total > 0 &&
          data.map((d, i) => (
            <span key={d.label} className="h-full border-r-2 border-white last:border-r-0" style={{ width: `${(d.count / total) * 100}%`, background: shades[i % shades.length] }} />
          ))}
      </div>
      <ul className="mt-4 space-y-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: shades[i % shades.length] }} />
            <span className="flex-1">{d.label}</span>
            <span className="tabular-nums font-medium">{d.count.toLocaleString('en-IN')}</span>
            <span className={cn('w-11 text-right tabular-nums text-muted')}>{total ? Math.round((d.count / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
