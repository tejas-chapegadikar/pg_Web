import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { adminApi, type ActivityEntry } from '@/api/admin';
import { cn } from '@/lib/utils';
import { ACTION_LABEL, ROLE_LABEL } from './labels';
import {
  Avatar, Badge, Card, EmptyState, PageHeader, Pager, Select, SkeletonRows,
} from './ui';
import { fmtDateTime, timeAgo } from './format';

const TYPES = [
  { value: '', label: 'Everything' },
  { value: 'property', label: 'Properties' },
  { value: 'user', label: 'Users' },
  { value: 'waitlist', label: 'Waitlist' },
  { value: 'settings', label: 'Settings' },
];

/** Read-only: the server has no way to edit or delete these */
export function LogsPage() {
  const [params, setParams] = useSearchParams();
  const q = { type: params.get('type') ?? '', admin: params.get('admin') ?? '', page: Number(params.get('page')) || 1 };
  const set = (patch: Partial<typeof q>) => {
    const next = { ...q, page: 1, ...patch };
    setParams(Object.fromEntries(Object.entries(next).filter(([k, v]) => v && !(k === 'page' && v === 1)).map(([k, v]) => [k, String(v)])), { replace: true });
  };
  const { data, isPending, isFetching } = useQuery({
    queryKey: ['admin-logs', q],
    queryFn: () => adminApi.logs({ ...q, limit: 30 }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader title="Activity logs" description="Every change made in this panel, and who made it. Logs can’t be edited or deleted." />
      <Card>
        <div className="flex flex-col gap-2 border-b border-black/[0.06] p-3 sm:flex-row">
          <Select aria-label="What changed" value={q.type} onChange={(e) => set({ type: e.target.value })} className="sm:w-44">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Admin" value={q.admin} onChange={(e) => set({ admin: e.target.value })} className="sm:w-56">
            <option value="">All admins</option>
            {data?.admins.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name || a.email}
              </option>
            ))}
          </Select>
        </div>
        {isPending ? (
          <SkeletonRows cols={3} />
        ) : !data?.items.length ? (
          <EmptyState title="Nothing logged yet" text="Changes you make in the admin panel will show up here." />
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <ul className="divide-y divide-black/[0.05]">
              {data.items.map((l) => (
                <LogRow key={l._id} log={l} />
              ))}
            </ul>
            <Pager info={data.pagination} onPage={(page) => set({ page })} />
          </div>
        )}
      </Card>
    </>
  );
}

const targetLink = (l: ActivityEntry) => {
  if (!l.targetId) return null;
  if (l.targetType === 'property') return `/admin/properties/${l.targetId}`;
  if (l.targetType === 'user') return `/admin/users?open=${l.targetId}`;
  if (l.targetType === 'waitlist') return `/admin/waitlist?open=${l.targetId}`;
  if (l.targetType === 'settings') return '/admin/settings';
  return null;
};

const show = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

function LogRow({ log: l }: { log: ActivityEntry }) {
  const [open, setOpen] = useState(false);
  const changes = Object.keys({ ...(l.before ?? {}), ...(l.after ?? {}) });
  const link = targetLink(l);
  const destructive = /delete|reject|suspend|deactivate/.test(l.action);

  return (
    <li className="px-5 py-3">
      <div className="flex items-start gap-3">
        <Avatar name={l.adminName || l.adminEmail} size={30} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug">
            <span className="font-medium">{l.adminName || l.adminEmail}</span>{' '}
            {l.adminRole && <span className="text-muted">({ROLE_LABEL[l.adminRole]})</span>}{' '}
            <span className={cn(destructive && 'text-red-700')}>{(ACTION_LABEL[l.action] ?? l.action).toLowerCase()}</span>
            {l.summary && (
              <>
                {': '}
                {link ? (
                  <Link to={link} className="font-medium underline-offset-2 hover:underline">
                    {l.summary}
                  </Link>
                ) : (
                  <span className="font-medium">{l.summary}</span>
                )}
              </>
            )}
          </p>
          <p className="mt-0.5 text-[12px] text-muted" title={fmtDateTime(l.createdAt)}>
            {timeAgo(l.createdAt)} · {fmtDateTime(l.createdAt)}
          </p>
          {changes.length > 0 && (
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
              {changes.length} field{changes.length === 1 ? '' : 's'} changed
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
            </button>
          )}
          {open && (
            <div className="mt-2 overflow-x-auto rounded-lg border border-black/[0.07]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-black/[0.02] text-left text-muted">
                    <th className="px-3 py-1.5 font-medium">Field</th>
                    <th className="px-3 py-1.5 font-medium">Before</th>
                    <th className="px-3 py-1.5 font-medium">After</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((k) => (
                    <tr key={k} className="border-t border-black/[0.05] align-top">
                      <td className="whitespace-nowrap px-3 py-1.5 font-medium">{k}</td>
                      <td className="max-w-[240px] break-words px-3 py-1.5 text-muted">{show(l.before?.[k])}</td>
                      <td className="max-w-[240px] break-words px-3 py-1.5">{show(l.after?.[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {l.targetType && <Badge className="hidden sm:inline-flex">{l.targetType}</Badge>}
      </div>
    </li>
  );
}
