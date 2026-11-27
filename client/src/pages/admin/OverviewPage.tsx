import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import { adminApi } from '@/api/admin';
import { formatRent } from '@/components/listing/meta';
import { useAdmin } from './adminContext';
import { BarList, SplitBar, TrendChart } from './charts';
import { listingState, MODE_META } from './labels';
import {
  Avatar, Badge, Button, Card, CardHeader, EmptyState, PageHeader, StatCard,
} from './ui';
import { timeAgo, titleCase } from './format';

export function OverviewPage() {
  const { user } = useAdmin();
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['admin-overview'], queryFn: adminApi.overview, refetchInterval: 60_000 });
  const s = data?.stats;
  const first = (user.name || '').split(' ')[0];

  if (isError) {
    return (
      <Card>
        <EmptyState title="Couldn’t load the overview" text="Check your connection and try again." action={<Button onClick={() => refetch()}>Try again</Button>} />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={first ? `Good to see you, ${first}` : 'Overview'}
        description={data ? `The site is in ${MODE_META[data.mode].label} mode. ${MODE_META[data.mode].text}` : 'Everything on anieghar at a glance.'}
        actions={
          <Link to="/admin/properties/new">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              Add property
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total listings" value={s?.totalListings} loading={isPending} />
        <StatCard label="Active PGs" value={s?.activePG} loading={isPending} />
        <StatCard label="Active flats" value={s?.activeFlat} loading={isPending} />
        <StatCard
          label="Pending approval"
          value={s?.pending}
          loading={isPending}
          hint={s?.pending ? <Link to="/admin/properties?status=pending" className="underline-offset-2 hover:underline">Review now</Link> : 'Nothing waiting'}
        />
        <StatCard label="Waitlist" value={s?.waitlistTotal} loading={isPending} hint={s && `+${s.waitlistNewWeek} this week`} />
        <StatCard label="Not yet contacted" value={s?.waitlistUncontacted} loading={isPending} hint="Waitlist status: New" />
        <StatCard label="Students" value={s?.students} loading={isPending} hint="Registered accounts" />
        <StatCard label="Brokers" value={s?.brokers} loading={isPending} hint="Registered accounts" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Waitlist sign-ups" description="Last 30 days" />
          <div className="px-4 pb-3 pt-4">{data ? <TrendChart data={data.charts.waitlistTrend} label="Waitlist sign-ups" /> : <div className="skeleton h-[180px] rounded-lg" />}</div>
        </Card>
        <Card>
          <CardHeader title="New listings" description="Last 30 days" />
          <div className="px-4 pb-3 pt-4">{data ? <TrendChart data={data.charts.listingTrend} label="New listings" /> : <div className="skeleton h-[180px] rounded-lg" />}</div>
        </Card>
        <Card>
          <CardHeader title="PG vs flat" description="All listings" />
          <div className="px-5 py-5">{data ? <SplitBar data={data.charts.typeSplit} /> : <div className="skeleton h-24 rounded-lg" />}</div>
        </Card>
        <Card>
          <CardHeader title="Listings by city" />
          <div className="px-5 py-5">{data ? <BarList data={data.charts.listingsByCity} empty="No listings yet" /> : <div className="skeleton h-24 rounded-lg" />}</div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recently added properties"
            action={
              <Link to="/admin/properties" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">
                All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {data && data.recentProperties.length === 0 && <EmptyState title="No properties yet" text="Add the first PG or flat." />}
          <ul className="divide-y divide-black/[0.05]">
            {data?.recentProperties.map((pg) => {
              const state = listingState(pg);
              return (
                <li key={pg._id}>
                  <Link to={`/admin/properties/${pg._id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-black/[0.02]">
                    <Thumb src={pg.images?.[0]?.url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{pg.title}</p>
                      <p className="truncate text-[12px] text-muted">
                        {pg.propertyType === 'flat' ? 'Flat' : 'PG'} · {titleCase(pg.location?.city)} · {formatRent(pg.rent)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={state.tone}>{state.label}</Badge>
                      <span className="text-[11.5px] text-muted">{timeAgo(pg.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Recent registrations"
            action={
              <Link to="/admin/users" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">
                All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {data && data.recentUsers.length === 0 && <EmptyState title="No accounts yet" />}
          <ul className="divide-y divide-black/[0.05]">
            {data?.recentUsers.map((u) => (
              <li key={u._id}>
                <Link to={`/admin/users?open=${u._id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-black/[0.02]">
                  <Avatar name={u.name || u.email} src={u.avatar} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{u.name || 'No name yet'}</p>
                    <p className="truncate text-[12px] text-muted">{u.email || u.phone}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge>{u.role === 'owner' ? 'Broker' : 'Student'}</Badge>
                    <span className="text-[11.5px] text-muted">{timeAgo(u.createdAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

export function Thumb({ src, size = 40 }: { src?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  return src && !broken ? (
    <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="shrink-0 rounded-lg object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="shrink-0 rounded-lg bg-black/[0.05]" style={{ width: size, height: size }} />
  );
}
