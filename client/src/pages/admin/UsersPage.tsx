import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, errorText, type AdminRole } from '@/api/admin';
import { formatRent } from '@/components/listing/meta';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { useAdmin } from './adminContext';
import { ACTION_LABEL, listingState, ROLE_LABEL } from './labels';
import {
  Avatar, Badge, Button, Card, ConfirmDialog, Drawer, EmptyState, Field, PageHeader, Pager, SearchInput, Select, SkeletonRows, Table, Textarea, td, th,
} from './ui';
import { fmtDate, fmtDateTime, timeAgo } from './format';

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const q = {
    q: params.get('q') ?? '',
    role: params.get('role') ?? '',
    status: params.get('status') ?? '',
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

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['admin-users', q],
    queryFn: () => adminApi.users({ ...q, limit: 25 }),
    placeholderData: keepPreviousData,
  });
  const filtered = Boolean(q.q || q.role || q.status);

  return (
    <>
      <PageHeader title="Users" description="Student and broker accounts. Accounts are suspended, never deleted." />
      <Card>
        <div className="flex flex-col gap-2 border-b border-black/[0.06] p-3 sm:flex-row">
          <SearchInput value={q.q} onChange={(v) => set({ q: v })} placeholder="Search name, email or phone" className="sm:flex-1" />
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Select aria-label="Account type" value={q.role} onChange={(e) => set({ role: e.target.value })} className="sm:w-32">
              <option value="">All types</option>
              <option value="student">Students</option>
              <option value="owner">Brokers</option>
            </Select>
            <Select aria-label="Status" value={q.status} onChange={(e) => set({ status: e.target.value })} className="sm:w-36">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
            <Select aria-label="Sort" value={q.sort} onChange={(e) => set({ sort: e.target.value })} className="sm:w-36">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </Select>
          </div>
        </div>

        {isPending ? (
          <SkeletonRows />
        ) : !data?.items.length ? (
          <EmptyState
            title={filtered ? 'No users match' : 'No accounts yet'}
            text={filtered ? 'Try clearing a filter.' : 'Accounts appear here once the app is public and people sign up.'}
            action={filtered ? <Button onClick={() => setParams({}, { replace: true })}>Clear filters</Button> : undefined}
          />
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <Table>
              <thead>
                <tr>
                  <th className={th}>User</th>
                  <th className={th}>Type</th>
                  <th className={th}>Phone</th>
                  <th className={th}>Listings</th>
                  <th className={th}>Status</th>
                  <th className={th}>Joined</th>
                  <th className={th}>Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u._id} className="cursor-pointer transition-colors hover:bg-black/[0.015]" onClick={() => setOpen(u._id)}>
                    <td className={td}>
                      <div className="flex min-w-[220px] items-center gap-3">
                        <Avatar name={u.name || u.email} src={u.avatar} />
                        <div className="min-w-0">
                          <button type="button" className="block max-w-[240px] truncate text-left font-medium hover:underline" onClick={() => setOpen(u._id)}>
                            {u.name || 'No name yet'}
                          </button>
                          <p className="truncate text-[12px] text-muted">{u.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className={td}>
                      <span className="flex items-center gap-1.5">
                        {u.role === 'owner' ? 'Broker' : 'Student'}
                        {u.adminRole && <Badge tone="dark">{ROLE_LABEL[u.adminRole]}</Badge>}
                      </span>
                    </td>
                    <td className={`${td} tabular-nums text-ink/80`}>{u.phone || <span className="text-muted">—</span>}</td>
                    <td className={`${td} tabular-nums`}>{u.role === 'owner' ? u.listingCount : <span className="text-muted">—</span>}</td>
                    <td className={td}>{u.isSuspended ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge>}</td>
                    <td className={`${td} whitespace-nowrap text-muted`}>{fmtDate(u.createdAt)}</td>
                    <td className={`${td} whitespace-nowrap text-muted`}>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager info={data.pagination} onPage={(page) => set({ page })} />
          </div>
        )}
      </Card>
      <UserDrawer id={openId} onClose={() => setOpen(null)} />
    </>
  );
}

function UserDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { user: me, role: myRole } = useAdmin();
  const qc = useQueryClient();
  const { addToast } = useUIStore();
  const { data, isPending } = useQuery({ queryKey: ['admin-user', id], queryFn: () => adminApi.user(id!), enabled: Boolean(id) });
  const [confirm, setConfirm] = useState<'suspend' | 'role' | null>(null);
  const [reason, setReason] = useState('');
  const [nextRole, setNextRole] = useState<'student' | 'owner'>('student');

  const update = useMutation({
    mutationFn: (body: Parameters<typeof adminApi.updateUser>[1]) => adminApi.updateUser(id!, body),
    onSuccess: (_, body) => {
      qc.invalidateQueries({ queryKey: ['admin-user', id] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
      setConfirm(null);
      setReason('');
      addToast({
        title: 'isSuspended' in body ? (body.isSuspended ? 'Account suspended' : 'Account reactivated') : 'adminRole' in body ? 'Admin access updated' : 'Account type changed',
        variant: 'success',
      });
    },
    onError: (err) => addToast({ title: 'That didn’t work', description: errorText(err), variant: 'destructive' }),
  });

  const u = data?.user;
  const isSelf = u?._id === me._id;
  const locked = isSelf || u?.adminFromConfig || (Boolean(u?.adminRole) && myRole !== 'founder');
  const lockReason = isSelf
    ? 'This is your own account. Another admin has to change it.'
    : u?.adminFromConfig
      ? 'This admin is set in the server settings and can’t be changed here.'
      : 'Only the founder can change another admin’s account.';

  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      title={u?.name || u?.email || 'User'}
      subtitle={u && <>{u.email || u.phone} · joined {fmtDate(u.createdAt)}</>}
    >
      {isPending || !data || !u ? (
        <div className="space-y-3">
          <div className="skeleton h-16 rounded-lg" />
          <div className="skeleton h-40 rounded-lg" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Avatar name={u.name || u.email} src={u.avatar} size={48} />
            <div className="flex flex-wrap gap-1.5">
              <Badge>{u.role === 'owner' ? 'Broker' : 'Student'}</Badge>
              {u.isSuspended ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge>}
              {u.adminRole && <Badge tone="dark">{ROLE_LABEL[u.adminRole]}</Badge>}
              {u.emailVerified && <Badge tone="blue">Email verified</Badge>}
            </div>
          </div>
          {u.isSuspended && u.suspendedReason && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-800">Suspended: {u.suspendedReason}</p>}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <Info label="Phone" value={u.phone ? `${u.phone}${u.phoneVerified ? ' (verified)' : ''}` : '—'} />
            <Info label="Last sign-in" value={u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : '—'} />
            <Info label="Onboarding" value={u.isOnboarded === false ? 'Not finished' : 'Done'} />
            <Info label="Waitlist" value={data.activity.waitlist ? `Joined ${fmtDate(data.activity.waitlist.createdAt)}` : 'Not on it'} />
            {u.role === 'owner' ? (
              <Info label="Requests received" value={String(data.activity.inquiriesReceived)} />
            ) : (
              <>
                <Info label="Requests sent" value={String(data.activity.inquiriesSent)} />
                <Info label="Saved listings" value={String(data.activity.saves)} />
              </>
            )}
          </dl>

          {u.role === 'owner' && (
            <section>
              <h3 className="mb-2 text-[12.5px] font-medium text-ink/80">Listings ({data.listings.length})</h3>
              {data.listings.length ? (
                <ul className="divide-y divide-black/[0.06] rounded-lg border border-black/[0.08]">
                  {data.listings.map((pg) => {
                    const s = listingState(pg);
                    return (
                      <li key={pg._id}>
                        <Link to={`/admin/properties/${pg._id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px] hover:bg-black/[0.02]">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{pg.title}</span>
                            <span className="text-[12px] text-muted">{formatRent(pg.rent)}</span>
                          </span>
                          <Badge tone={s.tone}>{s.label}</Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[12.5px] text-muted">No listings.</p>
              )}
            </section>
          )}

          <section className="space-y-3 rounded-lg border border-black/[0.08] p-4">
            <h3 className="text-[12.5px] font-medium text-ink/80">Manage account</h3>
            {locked ? (
              <p className="text-[12.5px] text-muted">{lockReason}</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px]">Account type</p>
                    <p className="text-[11.5px] text-muted">Users can’t change this themselves.</p>
                  </div>
                  <Select
                    aria-label="Account type"
                    className="w-32"
                    value={u.role}
                    onChange={(e) => {
                      setNextRole(e.target.value as 'student' | 'owner');
                      setConfirm('role');
                    }}
                  >
                    <option value="student">Student</option>
                    <option value="owner">Broker</option>
                  </Select>
                </div>

                {myRole === 'founder' && (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px]">Admin access</p>
                      <p className="text-[11.5px] text-muted">{u.emailVerified ? 'Lets them open this panel.' : 'Needs a verified email first.'}</p>
                    </div>
                    <Select
                      aria-label="Admin access"
                      className="w-32"
                      value={u.adminRole ?? ''}
                      disabled={!u.emailVerified || update.isPending}
                      onChange={(e) => update.mutate({ adminRole: (e.target.value || null) as AdminRole | null })}
                    >
                      <option value="">None</option>
                      <option value="cofounder">Co-founder</option>
                      <option value="founder">Founder</option>
                    </Select>
                  </div>
                )}

                <div className="pt-1">
                  {u.isSuspended ? (
                    <Button variant="primary" className="w-full" loading={update.isPending} onClick={() => update.mutate({ isSuspended: false })}>
                      Reactivate account
                    </Button>
                  ) : (
                    <Button variant="ghost" className="w-full text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirm('suspend')}>
                      Suspend account
                    </Button>
                  )}
                </div>
              </>
            )}
          </section>

          {Boolean(data.logs.length) && (
            <section>
              <h3 className="mb-2 text-[12.5px] font-medium text-ink/80">Admin changes to this account</h3>
              <ul className="space-y-2 text-[12.5px]">
                {data.logs.map((l) => (
                  <li key={l._id} className={cn('flex justify-between gap-3')}>
                    <span>
                      {ACTION_LABEL[l.action] ?? l.action} <span className="text-muted">by {l.adminName || l.adminEmail}</span>
                    </span>
                    <span className="shrink-0 text-muted">{timeAgo(l.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'suspend'}
        onClose={() => setConfirm(null)}
        loading={update.isPending}
        onConfirm={() => update.mutate({ isSuspended: true, reason })}
        title={`Suspend ${u?.name || u?.email || 'this account'}?`}
        confirmLabel="Suspend account"
        body="They’ll be signed out on every device and can’t sign in until you reactivate them. Their data and listings stay as they are."
      >
        <Field label="Reason (only admins see this)" className="mt-4" htmlFor="suspend-reason">
          <Textarea id="suspend-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'role'}
        onClose={() => setConfirm(null)}
        loading={update.isPending}
        danger={false}
        onConfirm={() => update.mutate({ role: nextRole })}
        title={`Make this a ${nextRole === 'owner' ? 'broker' : 'student'} account?`}
        confirmLabel={`Change to ${nextRole === 'owner' ? 'broker' : 'student'}`}
        body={nextRole === 'owner' ? 'They’ll get the broker dashboard and can add listings.' : 'They’ll lose the broker dashboard. Their existing listings stay.'}
      />
    </Drawer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
