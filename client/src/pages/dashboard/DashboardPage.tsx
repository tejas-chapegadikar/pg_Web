import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, CalendarDays, Camera, Eye, Heart, MapPin, MessageSquare, Plus, Sparkles } from 'lucide-react';
import { useDashboard, useOwnerInquiries } from '@/hooks/useInquiry';
import { useMyListings } from '@/hooks/usePG';
import { useAuthStore } from '@/stores/authStore';
import { formatVisitDate, timeAgo } from '@/lib/dates';
import { buttonClasses } from '@/components/ds/styles';
import { PageHeader } from '@/components/ds/PageHeader';
import { Avatar, ListingThumb, StatTile, StatusPill } from '@/components/dashboard/parts';
import { formatRent, roomLabel } from '@/components/listing/meta';
import type { Inquiry, PGListing, User } from '@/types';

export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: statsData, isLoading: statsLoading } = useDashboard();
  const { data: listingsData, isLoading: listingsLoading } = useMyListings();
  const { data: inboxData, isLoading: inboxLoading } = useOwnerInquiries();

  const stats = statsData?.data;
  const listings: PGListing[] = listingsData?.data?.listings ?? [];
  const requests: Inquiry[] = inboxData?.inquiries ?? [];
  const pending: number = stats?.inquiryByStatus?.pending ?? 0;
  const available = listings.filter((l) => l.availableRooms > 0).length;
  const firstName = user?.name?.split(' ')[0];

  const addButton = (
    <Link to="/dashboard/listings/new" id="add-listing-btn" className={buttonClasses('primary', 'md', 'sm:hidden')}>
      <Plus className="h-4 w-4" />
      Add listing
    </Link>
  );

  if (listingsLoading || statsLoading) return <DashboardSkeleton />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        title="Your dashboard"
        description={listings.length ? 'How your listings are doing' : 'Get your first place in front of students'}
        actions={addButton}
      />

      {listings.length === 0 ? (
        <WelcomeCard />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile tint="sky" icon={<Building2 className="h-5 w-5" />} label="Listings" value={listings.length} note={`${available} available`} />
            <StatTile tint="violet" icon={<Eye className="h-5 w-5" />} label="Views" value={stats?.totalViews ?? 0} />
            <StatTile
              tint="emerald"
              icon={<MessageSquare className="h-5 w-5" />}
              label="Requests"
              value={stats?.totalInquiries ?? 0}
              note={pending ? `${pending} new` : undefined}
            />
            <StatTile tint="amber" icon={<Heart className="h-5 w-5" />} label="Saved by students" value={stats?.totalSaves ?? 0} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <Panel title="Latest requests" link={{ to: '/dashboard/inquiries', label: 'All requests' }}>
              {inboxLoading ? (
                <RowsSkeleton />
              ) : requests.length === 0 ? (
                <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted">
                  No requests yet. Students’ visit requests will show up here.
                </p>
              ) : (
                <ul className="divide-y divide-black/[0.06]">
                  {requests.slice(0, 5).map((inq) => (
                    <RequestRow key={inq._id} inquiry={inq} />
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Your listings" link={{ to: '/dashboard/listings', label: 'Manage' }}>
              <ul className="space-y-2">
                {listings.slice(0, 5).map((pg) => (
                  <li key={pg._id}>
                    <Link to={`/pg/${pg._id}`} className="group flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-surface">
                      <ListingThumb pg={pg} className="h-14 w-14 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{pg.title}</p>
                        <p className="mt-0.5 truncate text-[13px] text-muted">
                          {formatRent(pg.rent)}/mo ·{' '}
                          <span className={pg.availableRooms > 0 ? '' : 'text-red-600'}>
                            {pg.availableRooms > 0 ? roomLabel(pg, true) : 'Full'}
                          </span>{' '}
                          · {pg.analytics?.views ?? 0} views
                        </p>
                      </div>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] transition-colors group-hover:bg-white">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function RequestRow({ inquiry }: { inquiry: Inquiry }) {
  const student = typeof inquiry.student === 'object' ? (inquiry.student as User) : undefined;
  const pg = typeof inquiry.pg === 'object' ? inquiry.pg : undefined;
  return (
    <li>
      <Link to="/dashboard/inquiries" className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
        <Avatar name={student?.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium">{student?.name || 'Student'}</p>
            <StatusPill status={inquiry.status} audience="broker" />
          </div>
          <p className="truncate text-[13px] text-muted">
            {pg?.title ?? 'A listing'} · {timeAgo(inquiry.createdAt)}
          </p>
          {inquiry.visitDate && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">
              <CalendarDays className="h-3.5 w-3.5" />
              Visit {formatVisitDate(inquiry.visitDate)}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

function Panel({ title, link, children }: { title: string; link: { to: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-black/[0.06] bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <Link to={link.to} className="text-[13px] font-medium text-muted transition-colors hover:text-ink">
          {link.label}
        </Link>
      </div>
      {children}
    </section>
  );
}

/** First visit: no listings yet */
function WelcomeCard() {
  const steps = [
    { icon: Sparkles, title: 'Describe the place', text: 'PG or flat, rent, who can stay and what’s included.' },
    { icon: MapPin, title: 'Pin the location', text: 'So students searching near their college find it.' },
    { icon: Camera, title: 'Add real photos', text: 'Listings with photos get far more requests.' },
  ];
  return (
    <section className="overflow-hidden rounded-[32px] bg-emerald-50 p-6 sm:p-10">
      <p className="text-[13px] font-medium text-emerald-800">Takes about 5 minutes</p>
      <h2 className="mt-1 text-[26px] font-semibold tracking-tight sm:text-[30px]">List your first place</h2>
      <p className="mt-2 max-w-lg text-sm text-emerald-900/70">
        Once it’s live, students can find it, save it and send you visit requests — they’ll all show up here.
      </p>
      <Link to="/dashboard/listings/new" id="first-listing-btn" className={buttonClasses('primary', 'md', 'mt-6')}>
        <Plus className="h-4 w-4" />
        Add your first listing
      </Link>
      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="rounded-[22px] bg-white/80 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium text-emerald-800">Step {i + 1}</span>
            </div>
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-0.5 text-[13px] text-muted">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface" />
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="mb-8 h-16 w-64 animate-pulse rounded-2xl bg-surface" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-[24px] bg-surface" />
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="h-72 animate-pulse rounded-[28px] bg-surface" />
        <div className="h-72 animate-pulse rounded-[28px] bg-surface" />
      </div>
    </div>
  );
}
