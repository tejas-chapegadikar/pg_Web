import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { BadgeCheck, Check, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { adminApi, type AdminListing } from '@/api/admin';
import { formatRent, genderLabel, roomLabel } from '@/components/listing/meta';
import type { PGListing } from '@/types';
import { usePropertyActions } from './propertyActions';
import { Thumb } from './OverviewPage';
import { listingState } from './labels';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, PageHeader, Pager, SearchInput, Select, SkeletonRows, Table, Textarea, td, th,
} from './ui';
import { fmtDate, titleCase } from './format';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'verified', label: 'Verified' },
];

type Pending = { kind: 'delete' | 'reject' | 'deactivate'; pg: AdminListing } | null;

export function PropertiesPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = {
    q: params.get('q') ?? '',
    type: params.get('type') ?? '',
    status: params.get('status') ?? '',
    city: params.get('city') ?? '',
    sort: params.get('sort') ?? 'newest',
    page: Number(params.get('page')) || 1,
  };
  const set = (patch: Partial<typeof q>) => {
    const next = { ...q, page: 1, ...patch };
    setParams(Object.fromEntries(Object.entries(next).filter(([k, v]) => v && !(k === 'page' && v === 1) && !(k === 'sort' && v === 'newest')).map(([k, v]) => [k, String(v)])), { replace: true });
  };

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['admin-properties', q],
    queryFn: () => adminApi.properties({ ...q, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const { action, remove } = usePropertyActions();
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState('');

  const confirm = () => {
    if (!pending) return;
    const close = () => {
      setPending(null);
      setReason('');
    };
    if (pending.kind === 'delete') remove.mutate(pending.pg._id, { onSuccess: close });
    else action.mutate({ id: pending.pg._id, action: pending.kind, reason }, { onSuccess: close });
  };

  return (
    <>
      <PageHeader
        title="Properties"
        description="Every PG and flat on anieghar. Changes here show in the app straight away."
        actions={
          <>
            <Link to="/admin/properties/new?type=flat">
              <Button icon={<Plus className="h-4 w-4" />}>Add flat</Button>
            </Link>
            <Link to="/admin/properties/new?type=pg">
              <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
                Add PG
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-3 flex gap-1 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Listing status">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={q.status === t.value}
            onClick={() => set({ status: t.value })}
            className={`h-8 shrink-0 rounded-lg px-3 text-[13px] transition-colors ${q.status === t.value ? 'bg-ink font-medium text-white' : 'text-ink/65 hover:bg-black/[0.05] hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-2 border-b border-black/[0.06] p-3 sm:flex-row">
          <SearchInput value={q.q} onChange={(v) => set({ q: v })} placeholder="Search name, address, contact" className="sm:flex-1" />
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Select aria-label="Type" value={q.type} onChange={(e) => set({ type: e.target.value })} className="sm:w-32">
              <option value="">All types</option>
              <option value="pg">PG</option>
              <option value="flat">Flat</option>
            </Select>
            <Select aria-label="City" value={q.city} onChange={(e) => set({ city: e.target.value })} className="sm:w-36">
              <option value="">All cities</option>
              {data?.cities.map((c) => (
                <option key={c} value={c}>
                  {titleCase(c)}
                </option>
              ))}
            </Select>
            <Select aria-label="Sort" value={q.sort} onChange={(e) => set({ sort: e.target.value })} className="sm:w-40">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="rent_asc">Rent: low to high</option>
              <option value="rent_desc">Rent: high to low</option>
              <option value="views">Most viewed</option>
            </Select>
          </div>
        </div>

        {isPending ? (
          <SkeletonRows cols={6} />
        ) : !data?.items.length ? (
          <EmptyState
            title={q.q || q.type || q.status || q.city ? 'No listings match these filters' : 'No properties yet'}
            text={q.q || q.type || q.status || q.city ? 'Try clearing a filter.' : 'Add the first PG or flat to get started.'}
            action={
              q.q || q.type || q.status || q.city ? (
                <Button onClick={() => setParams({}, { replace: true })}>Clear filters</Button>
              ) : (
                <Link to="/admin/properties/new">
                  <Button variant="primary">Add property</Button>
                </Link>
              )
            }
          />
        ) : (
          <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <Table>
              <thead>
                <tr>
                  <th className={th}>Property</th>
                  <th className={th}>Type</th>
                  <th className={th}>Rent</th>
                  <th className={th}>Room</th>
                  <th className={th}>For</th>
                  <th className={th}>Status</th>
                  <th className={th}>Added</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((pg) => {
                  const state = listingState(pg);
                  const asListing = pg as unknown as PGListing;
                  return (
                    <tr key={pg._id} className="group cursor-pointer transition-colors hover:bg-black/[0.015]" onClick={() => navigate(`/admin/properties/${pg._id}`)}>
                      <td className={td}>
                        <div className="flex min-w-[220px] items-center gap-3">
                          <Thumb src={pg.images?.[0]?.url} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1 truncate font-medium">
                              <span className="truncate">{pg.title}</span>
                              {pg.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-[#0046FF]" aria-label="Verified" />}
                            </p>
                            <p className="truncate text-[12px] text-muted">
                              {[pg.location?.locality, titleCase(pg.location?.city)].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={td}>{pg.propertyType === 'flat' ? 'Flat' : 'PG'}</td>
                      <td className={`${td} tabular-nums`}>{formatRent(pg.rent)}</td>
                      <td className={td}>{roomLabel(asListing, true)}</td>
                      <td className={td}>{genderLabel(asListing, true)}</td>
                      <td className={td}>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </td>
                      <td className={`${td} whitespace-nowrap text-muted`}>{fmtDate(pg.createdAt)}</td>
                      <td className={`${td} text-right`} onClick={(e) => e.stopPropagation()}>
                        <RowMenu
                          pg={pg}
                          onEdit={() => navigate(`/admin/properties/${pg._id}`)}
                          onAction={(a) => (a === 'reject' || a === 'deactivate' ? setPending({ kind: a, pg }) : action.mutate({ id: pg._id, action: a }))}
                          onDelete={() => setPending({ kind: 'delete', pg })}
                        />
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

      <ConfirmDialog
        open={pending?.kind === 'delete'}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        loading={remove.isPending}
        title="Delete this listing?"
        confirmLabel="Delete listing"
        body={
          <>
            <strong className="font-medium text-ink">{pending?.pg.title}</strong> will be removed from anieghar for good. Students won’t see it and the broker loses it from their
            dashboard. To hide it for now instead, deactivate it.
          </>
        }
      />
      <ConfirmDialog
        open={pending?.kind === 'deactivate'}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        loading={action.isPending}
        danger={false}
        title="Deactivate this listing?"
        confirmLabel="Deactivate"
        body={
          <>
            <strong className="font-medium text-ink">{pending?.pg.title}</strong> will be hidden from students until you reactivate it. Nothing is deleted.
          </>
        }
      />
      <ConfirmDialog
        open={pending?.kind === 'reject'}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        loading={action.isPending}
        title="Reject this listing?"
        confirmLabel="Reject listing"
        body={
          <>
            <strong className="font-medium text-ink">{pending?.pg.title}</strong> won’t be shown to students. If the broker edits it, it comes back for review.
          </>
        }
      >
        <Field label="Reason (shown to the team)" className="mt-4" htmlFor="reject-reason">
          <Textarea id="reject-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Photos are blurry" />
        </Field>
      </ConfirmDialog>
    </>
  );
}

function RowMenu({ pg, onEdit, onAction, onDelete }: { pg: AdminListing; onEdit: () => void; onAction: (a: string) => void; onDelete: () => void }) {
  const item = 'flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] outline-none data-[highlighted]:bg-black/[0.05]';
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton label={`Actions for ${pg.title}`}>
          <MoreHorizontal className="h-4 w-4" />
        </IconButton>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={4} className="animate-fade-in z-50 min-w-[190px] rounded-lg border border-black/[0.08] bg-white p-1 shadow-xl">
          <Menu.Item className={item} onSelect={onEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </Menu.Item>
          {pg.status === 'pending' && (
            <>
              <Menu.Item className={item} onSelect={() => onAction('approve')}>
                <Check className="h-4 w-4" /> Approve
              </Menu.Item>
              <Menu.Item className={item} onSelect={() => onAction('reject')}>
                <X className="h-4 w-4" /> Reject
              </Menu.Item>
            </>
          )}
          {pg.status === 'rejected' && (
            <Menu.Item className={item} onSelect={() => onAction('approve')}>
              <Check className="h-4 w-4" /> Approve
            </Menu.Item>
          )}
          {pg.isActive === false ? (
            <Menu.Item className={item} onSelect={() => onAction('activate')}>
              <Eye className="h-4 w-4" /> Reactivate
            </Menu.Item>
          ) : (
            <Menu.Item className={item} onSelect={() => onAction('deactivate')}>
              <EyeOff className="h-4 w-4" /> Deactivate
            </Menu.Item>
          )}
          <Menu.Item className={item} onSelect={() => onAction(pg.isVerified ? 'unverify' : 'verify')}>
            <BadgeCheck className="h-4 w-4" /> {pg.isVerified ? 'Remove verified' : 'Mark verified'}
          </Menu.Item>
          <Menu.Separator className="my-1 h-px bg-black/[0.06]" />
          <Menu.Item className={`${item} text-red-600`} onSelect={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
