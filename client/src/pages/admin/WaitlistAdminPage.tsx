import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { adminApi, errorText, type WaitlistRow, type WaitlistStatus } from '@/api/admin';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { WAITLIST_STATUS, waitlistStatusMeta } from './labels';
import {
  Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Pager, SearchInput, Select, SkeletonRows, Table, Textarea, td, th,
} from './ui';
import { fmtDate, fmtDateTime, timeAgo } from './format';
import { ADMIN } from './adminPath';

export function WaitlistAdminPage() {
  const [params, setParams] = useSearchParams();
  const { addToast } = useUIStore();
  const q = {
    q: params.get('q') ?? '',
    status: params.get('status') ?? '',
    role: params.get('role') ?? '',
    college: params.get('college') ?? '',
    city: params.get('city') ?? '',
    sort: params.get('sort') ?? 'newest',
    page: Number(params.get('page')) || 1,
  };
  const set = (patch: Partial<typeof q>) => {
    const next = { ...q, page: 1, ...patch };
    setParams(Object.fromEntries(Object.entries(next).filter(([k, v]) => v && !(k === 'page' && v === 1) && !(k === 'sort' && v === 'newest')).map(([k, v]) => [k, String(v)])), { replace: true });
  };
  const openId = params.get('open');
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('open', id);
    else next.delete('open');
    setParams(next, { replace: true });
  };

  // Polls so new sign-ups appear without reloading
  const { data, isPending, isFetching } = useQuery({
    queryKey: ['admin-waitlist', q],
    queryFn: () => adminApi.waitlist({ ...q, limit: 25 }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      await adminApi.exportWaitlist(q);
    } catch (err) {
      addToast({ title: 'Couldn’t export', description: errorText(err), variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const counts = data?.statusCounts ?? {};
  const all = Object.values(counts).reduce((s, n) => s + n, 0);
  const filtered = Boolean(q.q || q.role || q.college || q.city || q.status);

  return (
    <>
      <PageHeader
        title="Waitlist"
        description="Everyone who joined from the front page. New sign-ups appear here on their own."
        actions={
          <Button onClick={exportCsv} loading={exporting} icon={<Download className="h-4 w-4" />}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-3 flex gap-1 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Contact status">
        {[{ value: '', label: 'All', count: all }, ...WAITLIST_STATUS.map((s) => ({ value: s.value, label: s.label, count: counts[s.value] ?? 0 }))].map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={q.status === t.value}
            onClick={() => set({ status: t.value })}
            className={cn(
              'flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] transition-colors',
              q.status === t.value ? 'bg-ink font-medium text-white' : 'text-ink/65 hover:bg-black/[0.05] hover:text-ink'
            )}
          >
            {t.label}
            <span className={cn('tabular-nums text-[12px]', q.status === t.value ? 'text-white/70' : 'text-muted')}>{t.count}</span>
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-2 border-b border-black/[0.06] p-3 lg:flex-row">
          <SearchInput value={q.q} onChange={(v) => set({ q: v })} placeholder="Search email, name or phone" className="lg:flex-1" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
            <Select aria-label="Type" value={q.role} onChange={(e) => set({ role: e.target.value })} className="lg:w-32">
              <option value="">Everyone</option>
              <option value="student">Students</option>
              <option value="owner">Brokers</option>
            </Select>
            <Select aria-label="College" value={q.college} onChange={(e) => set({ college: e.target.value })} className="lg:w-40">
              <option value="">All colleges</option>
              {data?.colleges.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select aria-label="City" value={q.city} onChange={(e) => set({ city: e.target.value })} className="lg:w-32">
              <option value="">All cities</option>
              {data?.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select aria-label="Sort" value={q.sort} onChange={(e) => set({ sort: e.target.value })} className="lg:w-36">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </Select>
          </div>
        </div>

        {isPending ? (
          <SkeletonRows />
        ) : !data?.items.length ? (
          <EmptyState
            title={filtered ? 'No registrations match' : 'No one on the waitlist yet'}
            text={filtered ? 'Try clearing a filter.' : 'Share the front page to get the first sign-ups.'}
            action={filtered ? <Button onClick={() => setParams({}, { replace: true })}>Clear filters</Button> : undefined}
          />
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <Table>
              <thead>
                <tr>
                  <th className={th}>Email</th>
                  <th className={th}>Name</th>
                  <th className={th}>Type</th>
                  <th className={th}>College</th>
                  <th className={th}>City</th>
                  <th className={th}>Status</th>
                  <th className={th}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => {
                  const s = waitlistStatusMeta(e.status);
                  return (
                    <tr key={e._id} className="cursor-pointer transition-colors hover:bg-black/[0.015]" onClick={() => setOpen(e._id)}>
                      <td className={td}>
                        <button type="button" className="max-w-[260px] truncate text-left font-medium hover:underline" onClick={() => setOpen(e._id)}>
                          {e.email}
                        </button>
                        {Boolean(e.notes?.length) && <span className="ml-2 text-[11.5px] text-muted">{e.notes!.length} note{e.notes!.length === 1 ? '' : 's'}</span>}
                      </td>
                      <td className={`${td} text-ink/80`}>{e.name || <span className="text-muted">—</span>}</td>
                      <td className={td}>{e.role === 'owner' ? 'Broker' : 'Student'}</td>
                      <td className={`${td} text-ink/80`}>{e.college || <span className="text-muted">—</span>}</td>
                      <td className={`${td} text-ink/80`}>{e.city || <span className="text-muted">—</span>}</td>
                      <td className={td}>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                      <td className={`${td} whitespace-nowrap text-muted`} title={fmtDateTime(e.createdAt)}>
                        {timeAgo(e.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pager info={data.pagination} onPage={(page) => set({ page })} />
          </div>
        )}
      </Card>

      <EntryDrawer id={openId} onClose={() => setOpen(null)} />
    </>
  );
}

function EntryDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { addToast } = useUIStore();
  const { data: entry, isPending } = useQuery({ queryKey: ['admin-waitlist-entry', id], queryFn: () => adminApi.waitlistEntry(id!), enabled: Boolean(id) });
  const [details, setDetails] = useState({ name: '', phone: '', college: '', city: '' });
  const [note, setNote] = useState('');

  // Fill the boxes once per registration opened (a status change mustn't wipe what's being typed)
  const [filledFor, setFilledFor] = useState<string | null>(null);
  if (entry && entry._id !== filledFor) {
    setFilledFor(entry._id);
    setDetails({ name: entry.name ?? '', phone: entry.phone ?? '', college: entry.college ?? '', city: entry.city ?? '' });
    setNote('');
  }

  const store = (next: WaitlistRow) => {
    qc.setQueryData(['admin-waitlist-entry', id], (old: WaitlistRow | undefined) => ({ ...old, ...next, account: old?.account }));
    qc.invalidateQueries({ queryKey: ['admin-waitlist'] });
    qc.invalidateQueries({ queryKey: ['admin-overview'] });
  };
  const fail = (err: unknown) => addToast({ title: 'Couldn’t save', description: errorText(err), variant: 'destructive' });

  const update = useMutation({
    mutationFn: (body: Partial<WaitlistRow>) => adminApi.updateWaitlist(id!, body),
    onSuccess: (next, body) => {
      store(next);
      addToast({ title: body.status ? `Marked as ${waitlistStatusMeta(body.status).label}` : 'Details saved', variant: 'success' });
    },
    onError: fail,
  });
  const addNote = useMutation({
    mutationFn: (text: string) => adminApi.addWaitlistNote(id!, text),
    onSuccess: (next) => {
      store(next);
      setNote('');
    },
    onError: fail,
  });

  const dirty = entry && (['name', 'phone', 'college', 'city'] as const).some((k) => (entry[k] ?? '') !== details[k]);

  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={entry?.email ?? 'Registration'} subtitle={entry && `Joined ${fmtDate(entry.createdAt)} · ${entry.role === 'owner' ? 'Broker' : 'Student'}`}>
      {isPending || !entry ? (
        <div className="space-y-3">
          <div className="skeleton h-9 rounded-lg" />
          <div className="skeleton h-40 rounded-lg" />
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="mb-2 text-[12.5px] font-medium text-ink/80">Contact status</h3>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {WAITLIST_STATUS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={entry.status === s.value}
                  disabled={update.isPending}
                  onClick={() => entry.status !== s.value && update.mutate({ status: s.value as WaitlistStatus })}
                  className={cn(
                    'h-8 rounded-lg border text-[12.5px] font-medium transition-colors',
                    entry.status === s.value ? 'border-ink bg-ink text-white' : 'border-black/10 text-ink/75 hover:bg-black/[0.03]'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          {entry.account ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">
              Has an account: {entry.account.name || 'no name'} ({entry.account.role === 'owner' ? 'broker' : 'student'}), since {fmtDate(entry.account.createdAt)}.{' '}
              <Link to={`${ADMIN}/users?open=${entry.account._id}`} className="font-medium underline">
                Open profile
              </Link>
            </p>
          ) : (
            <p className="rounded-lg bg-black/[0.03] px-3 py-2 text-[12.5px] text-muted">No anieghar account with this email yet.</p>
          )}

          <section className="space-y-3">
            <h3 className="text-[12.5px] font-medium text-ink/80">Details</h3>
            <p className="-mt-2 text-[12px] text-muted">The join form only asks for email. Fill these in after you talk to them.</p>
            <div className="grid grid-cols-2 gap-3">
              {(['name', 'phone', 'college', 'city'] as const).map((k) => (
                <Field key={k} label={k[0].toUpperCase() + k.slice(1)} htmlFor={`wl-${k}`}>
                  <Input id={`wl-${k}`} value={details[k]} maxLength={k === 'college' ? 100 : 60} onChange={(e) => setDetails((d) => ({ ...d, [k]: e.target.value }))} />
                </Field>
              ))}
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="primary" disabled={!dirty} loading={update.isPending && !update.variables?.status} onClick={() => update.mutate(details)}>
                Save details
              </Button>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[12.5px] font-medium text-ink/80">Team notes</h3>
            <p className="mb-3 text-[12px] text-muted">Only admins see these.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (note.trim()) addNote.mutate(note.trim());
              }}
              className="space-y-2"
            >
              <Textarea aria-label="New note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called on 12 Nov, looking for a single room near JEC" rows={3} />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!note.trim()} loading={addNote.isPending}>
                  Add note
                </Button>
              </div>
            </form>
            <ul className="mt-4 space-y-3">
              {[...(entry.notes ?? [])].reverse().map((n) => (
                <li key={n._id} className="rounded-lg border border-black/[0.07] px-3 py-2.5">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{n.text}</p>
                  <p className="mt-1 text-[11.5px] text-muted">
                    {n.by} · {fmtDateTime(n.at)}
                  </p>
                </li>
              ))}
              {!entry.notes?.length && <li className="text-[12.5px] text-muted">No notes yet.</li>}
            </ul>
          </section>
        </div>
      )}
    </Drawer>
  );
}
