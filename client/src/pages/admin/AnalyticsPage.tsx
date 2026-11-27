import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi, type DayCount } from '@/api/admin';
import { formatRent } from '@/components/listing/meta';
import { cn } from '@/lib/utils';
import { BarList, SplitBar, TrendChart } from './charts';
import { waitlistStatusMeta } from './labels';
import {
  Card, CardHeader, PageHeader, StatCard,
} from './ui';
import { titleCase } from './format';
import { ADMIN } from './adminPath';

const RANGES = [7, 30, 90, 365];
const GENDER: Record<string, string> = { male: 'Boys', female: 'Girls', any: 'Co-ed / anyone' };

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isPending, isFetching } = useQuery({ queryKey: ['admin-analytics', days], queryFn: () => adminApi.analytics(days), placeholderData: keepPreviousData });
  const t = data?.totals;
  const chart = (rows: DayCount[] | undefined, label: string) =>
    rows ? <TrendChart data={rows} label={label} height={200} /> : <div className="skeleton h-[200px] rounded-lg" />;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Counted straight from the database."
        actions={
          <div className="flex rounded-lg border border-black/10 bg-white p-0.5" role="radiogroup" aria-label="Time range">
            {RANGES.map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={days === d}
                onClick={() => setDays(d)}
                className={cn('h-8 rounded-md px-3 text-[13px] transition-colors', days === d ? 'bg-ink font-medium text-white' : 'text-ink/65 hover:text-ink')}
              >
                {d === 365 ? '1 year' : `${d} days`}
              </button>
            ))}
          </div>
        }
      />

      <div className={cn('space-y-4 transition-opacity', isFetching && !isPending && 'opacity-70')}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Waitlist sign-ups" value={t?.waitlist} loading={isPending} hint={`Last ${days === 365 ? 'year' : `${days} days`}`} />
          <StatCard label="New listings" value={t?.listings} loading={isPending} hint={`Last ${days === 365 ? 'year' : `${days} days`}`} />
          <StatCard label="New accounts" value={t?.users} loading={isPending} hint={`Last ${days === 365 ? 'year' : `${days} days`}`} />
          <StatCard label="Visit requests" value={t?.inquiries} loading={isPending} hint={`Last ${days === 365 ? 'year' : `${days} days`}`} />
        </div>

        <Card>
          <CardHeader title="Waitlist sign-ups" description="Per day" />
          <div className="px-4 pb-3 pt-4">{chart(data?.waitlistTrend, 'Waitlist sign-ups')}</div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Listings added" description="Per day" />
            <div className="px-4 pb-3 pt-4">{chart(data?.listingTrend, 'Listings added')}</div>
          </Card>
          <Card>
            <CardHeader title="Accounts created" description="Per day" />
            <div className="px-4 pb-3 pt-4">{chart(data?.userTrend, 'Accounts created')}</div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="Waitlist by city" description="Where the team filled it in" />
            <div className="p-5">{data && <BarList data={data.waitlistByCity} />}</div>
          </Card>
          <Card>
            <CardHeader title="Waitlist by college" />
            <div className="p-5">{data && <BarList data={data.waitlistByCollege} />}</div>
          </Card>
          <Card>
            <CardHeader title="Waitlist follow-up" />
            <div className="p-5">
              {data && (
                <SplitBar
                  data={['new', 'contacted', 'interested', 'converted'].map((s) => ({
                    label: waitlistStatusMeta(s).label,
                    count: data.waitlistByStatus.filter((r) => (s === 'new' ? r.label === 'new' || r.label === 'Not given' : r.label === s)).reduce((a, r) => a + r.count, 0),
                  }))}
                />
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="Listings by city" />
            <div className="p-5">{data && <BarList data={data.listingsByCity} format={titleCase} />}</div>
          </Card>
          <Card>
            <CardHeader title="Who listings are for" />
            <div className="p-5">{data && <SplitBar data={data.listingsByGender.map((r) => ({ label: GENDER[r.label] ?? r.label, count: r.count }))} />}</div>
          </Card>
          <Card>
            <CardHeader title="Accounts" />
            <div className="p-5">
              {data && <SplitBar data={data.usersByRole.map((r) => ({ label: r.label === 'owner' ? 'Brokers' : 'Students', count: r.count }))} />}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Rent" description="All listings" />
            <div className="overflow-x-auto px-5 py-4">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[12px] text-muted">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Listings</th>
                    <th className="pb-2 font-medium">Average</th>
                    <th className="pb-2 font-medium">Range</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data?.rent.map((r) => (
                    <tr key={r.type} className="border-t border-black/[0.06]">
                      <td className="py-2.5">{r.type === 'flat' ? 'Flat' : 'PG'}</td>
                      <td className="py-2.5">{r.count}</td>
                      <td className="py-2.5 font-medium">{formatRent(r.avg)}</td>
                      <td className="py-2.5 text-muted">
                        {formatRent(r.min)} – {formatRent(r.max)}
                      </td>
                    </tr>
                  ))}
                  {data && !data.rent.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted">
                        No listings yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <CardHeader title="Most viewed listings" description="All time" />
            <ul className="divide-y divide-black/[0.05]">
              {data?.topViewed.map((pg) => (
                <li key={pg._id}>
                  <Link to={`${ADMIN}/properties/${pg._id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px] hover:bg-black/[0.02]">
                    <span className="min-w-0 truncate">
                      {pg.title} <span className="text-muted">· {titleCase(pg.location?.city)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{pg.analytics?.views ?? 0} views</span>
                  </Link>
                </li>
              ))}
              {data && !data.topViewed.length && <li className="px-5 py-6 text-center text-[13px] text-muted">No listings yet</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
