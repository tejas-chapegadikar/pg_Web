import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Inbox, MessageCircle, Phone } from 'lucide-react';
import { useDashboard, useOwnerInquiries, useStudentInquiries, useUpdateInquiryStatus } from '@/hooks/useInquiry';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { formatVisitDate, timeAgo } from '@/lib/dates';
import { Button } from '@/components/ds/Button';
import { EmptyState } from '@/components/ds/EmptyState';
import { PageHeader } from '@/components/ds/PageHeader';
import { buttonClasses } from '@/components/ds/styles';
import { Avatar, ListingThumb, StatusPill } from '@/components/dashboard/parts';
import { formatRent } from '@/components/listing/meta';
import type { Inquiry, PGListing, User } from '@/types';

type StatusFilter = '' | 'pending' | 'responded' | 'closed';

export function InquiriesPage() {
  const { user } = useAuthStore();
  return user?.role === 'owner' ? <BrokerInbox /> : <StudentRequests />;
}

/* ─── Broker ──────────────────────────────────────────────────────────── */

function BrokerInbox() {
  const [status, setStatus] = useState<StatusFilter>('');
  const { data, isLoading } = useOwnerInquiries({ status: status || undefined });
  const { data: stats } = useDashboard();
  const counts: Record<string, number> = stats?.data?.inquiryByStatus ?? {};
  const inquiries: Inquiry[] = data?.inquiries ?? [];
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const tabs: { value: StatusFilter; label: string; count?: number }[] = [
    { value: '', label: 'All', count: total },
    { value: 'pending', label: 'New', count: counts.pending ?? 0 },
    { value: 'responded', label: 'Responded', count: counts.responded ?? 0 },
    { value: 'closed', label: 'Closed', count: counts.closed ?? 0 },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Requests" description="Students asking about your places. Reply by phone or WhatsApp, then mark it done." />

      <div className="scrollbar-hide mb-5 flex gap-6 overflow-x-auto border-b border-black/[0.06]">
        {tabs.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setStatus(t.value)}
            className={cn(
              'relative shrink-0 pb-3 text-sm font-medium transition-colors',
              status === t.value ? 'text-ink' : 'text-muted hover:text-ink'
            )}
          >
            {t.label} <span className="text-muted">{t.count}</span>
            {status === t.value && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-ink" />}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : inquiries.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title={status ? 'Nothing here' : 'No requests yet'}
          text={status ? 'No requests with this status.' : 'When students ask about one of your listings, it shows up here.'}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {inquiries.map((inq) => (
            <BrokerRequestCard key={inq._id} inquiry={inq} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BrokerRequestCard({ inquiry }: { inquiry: Inquiry }) {
  const updateStatus = useUpdateInquiryStatus();
  const { addToast } = useUIStore();
  const student = typeof inquiry.student === 'object' ? (inquiry.student as User) : undefined;
  const pg = typeof inquiry.pg === 'object' ? (inquiry.pg as PGListing) : undefined;
  const digits = inquiry.phone?.replace(/\D/g, '') ?? '';
  const whatsapp = digits
    ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(
        `Hi${student?.name ? ` ${student.name.split(' ')[0]}` : ''}, this is about your request for ${pg?.title ?? 'my listing'} on Anei Ghar.`
      )}`
    : undefined;

  const setStatus = async (status: Inquiry['status']) => {
    try {
      await updateStatus.mutateAsync({ id: inquiry._id, status });
      addToast({ title: status === 'responded' ? 'Marked as responded' : 'Request closed', variant: 'success' });
    } catch {
      addToast({ title: 'Couldn’t update the request', variant: 'destructive' });
    }
  };

  return (
    <li className="rounded-[24px] border border-black/[0.06] bg-white p-5">
      <div className="flex items-start gap-4">
        <Avatar name={student?.name} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-semibold">{student?.name || 'Student'}</p>
            <StatusPill status={inquiry.status} audience="broker" />
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            About{' '}
            {pg ? (
              <Link to={`/pg/${pg._id}`} className="font-medium text-ink hover:underline">
                {pg.title}
              </Link>
            ) : (
              'a listing that was removed'
            )}{' '}
            · {timeAgo(inquiry.createdAt)}
          </p>

          <p className="mt-3 whitespace-pre-line rounded-2xl bg-surface px-4 py-3 text-sm leading-relaxed">{inquiry.message}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {inquiry.visitDate && (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-violet-50 px-3 text-[13px] font-medium text-violet-800">
                <CalendarDays className="h-4 w-4" />
                Wants to visit {formatVisitDate(inquiry.visitDate)}
              </span>
            )}
            {inquiry.phone && (
              <a href={`tel:${inquiry.phone}`} className={buttonClasses('secondary', 'sm', 'h-9')}>
                <Phone className="h-3.5 w-3.5" />
                {inquiry.phone}
              </a>
            )}
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClasses('secondary', 'sm', 'h-9')}>
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {inquiry.status !== 'closed' && (
        <div className="mt-4 flex justify-end gap-2 border-t border-black/[0.06] pt-4">
          <Button
            variant="ghost"
            size="sm"
            id={`close-inquiry-${inquiry._id}`}
            disabled={updateStatus.isPending}
            onClick={() => setStatus('closed')}
          >
            Close
          </Button>
          {inquiry.status !== 'responded' && (
            <Button
              size="sm"
              id={`mark-responded-${inquiry._id}`}
              loading={updateStatus.isPending && updateStatus.variables?.status === 'responded'}
              onClick={() => setStatus('responded')}
            >
              Mark as responded
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/* ─── Student ─────────────────────────────────────────────────────────── */

function StudentRequests() {
  const { data, isLoading } = useStudentInquiries();
  const inquiries: Inquiry[] = data?.data?.inquiries ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader title="My requests" description="Places you’ve asked about. Brokers reply on your phone." />

      {isLoading ? (
        <ListSkeleton />
      ) : inquiries.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="No requests yet"
          text="Found a place you like? Open it and tap “Request a visit”."
          action={
            <Link to="/" className={buttonClasses('primary', 'md')}>
              Explore places
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {inquiries.map((inq) => {
            const pg = typeof inq.pg === 'object' ? (inq.pg as PGListing) : undefined;
            const broker = (inq as Inquiry & { owner?: User | string }).owner;
            return (
              <li key={inq._id} className="flex flex-col gap-4 rounded-[24px] border border-black/[0.06] bg-white p-3 sm:flex-row">
                {pg ? (
                  <Link to={`/pg/${pg._id}`} className="block sm:w-40">
                    <ListingThumb pg={pg} className="aspect-[4/3] w-full rounded-[18px]" />
                  </Link>
                ) : (
                  <div className="aspect-[4/3] rounded-[18px] bg-surface sm:w-40" />
                )}
                <div className="min-w-0 flex-1 px-1 pb-1 sm:px-0 sm:py-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {pg ? (
                      <Link to={`/pg/${pg._id}`} className="truncate text-[15px] font-semibold hover:underline">
                        {pg.title}
                      </Link>
                    ) : (
                      <p className="text-[15px] font-semibold text-muted">Listing removed</p>
                    )}
                    <StatusPill status={inq.status} audience="student" />
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {pg && <>{formatRent(pg.rent)}/mo · </>}
                    {typeof broker === 'object' && broker?.name ? `${broker.name} · ` : ''}
                    Sent {timeAgo(inq.createdAt)}
                  </p>
                  {inq.visitDate && (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-[13px] font-medium text-violet-800">
                      <CalendarDays className="h-4 w-4" />
                      Visit {formatVisitDate(inq.visitDate)}
                    </p>
                  )}
                  <p className="mt-2 line-clamp-2 text-sm text-muted">“{inq.message}”</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-[24px] bg-surface" />
      ))}
    </div>
  );
}
