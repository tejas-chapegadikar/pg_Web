import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Inquiry, PGListing } from '@/types';

export function ListingThumb({ pg, className }: { pg: Pick<PGListing, 'images' | 'title'>; className?: string }) {
  const cover = pg.images?.[0]?.url;
  return (
    <div className={cn('shrink-0 overflow-hidden bg-surface', className)}>
      {cover ? (
        <img src={cover} alt={pg.title} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted">
          <ImageOff className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

const STATUS: Record<Inquiry['status'], { broker: string; student: string; className: string }> = {
  pending: { broker: 'New', student: 'Waiting for reply', className: 'bg-amber-50 text-amber-800' },
  viewed: { broker: 'Seen', student: 'Seen by broker', className: 'bg-sky-50 text-sky-800' },
  responded: { broker: 'Responded', student: 'Broker responded', className: 'bg-emerald-50 text-emerald-800' },
  closed: { broker: 'Closed', student: 'Closed', className: 'bg-surface text-muted' },
};

export function StatusPill({ status, audience }: { status: Inquiry['status']; audience: 'broker' | 'student' }) {
  const s = STATUS[status] ?? STATUS.pending;
  return (
    <span className={cn('inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-medium', s.className)}>
      {s[audience]}
    </span>
  );
}

/** Pastel icon tiles for dashboard numbers (like the colour-coded cards in the reference designs) */
const TINTS = {
  sky: 'bg-sky-50 text-sky-700',
  violet: 'bg-violet-50 text-violet-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
} as const;

export function StatTile({
  icon,
  label,
  value,
  note,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tint: keyof typeof TINTS;
}) {
  return (
    <div className="rounded-[24px] border border-black/[0.06] bg-white p-5">
      <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', TINTS[tint])}>{icon}</span>
      <p className="mt-4 text-[28px] font-semibold leading-none tracking-tight">{value}</p>
      <p className="mt-2 text-[13px] text-muted">
        {label}
        {note && <span className="text-ink"> · {note}</span>}
      </p>
    </div>
  );
}

export function Avatar({ name, className }: { name?: string; className?: string }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-white', className ?? 'h-10 w-10')}>
      {initials || '?'}
    </span>
  );
}
