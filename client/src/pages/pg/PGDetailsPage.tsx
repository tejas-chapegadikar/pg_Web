import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  ExternalLink,
  Heart,
  ImageOff,
  Images,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Share2,
  Star,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { usePGListing } from '@/hooks/usePG';
import { useCreateInquiry, useSavedListings, useStudentInquiries, useToggleSave } from '@/hooks/useInquiry';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { cn, formatDate, getInitials } from '@/lib/utils';
import { ReviewSection } from '@/components/pg/ReviewSection';
import { amenityMeta, formatRent, genderLabel, roomLabel, typeLabel, typeOf } from '@/components/listing/meta';
import type { Inquiry, PGImage, PGListing, User } from '@/types';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const mapsEnabled = Boolean(MAPS_KEY && MAPS_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE');

/** Visit dates are stored as UTC midnight, so format in UTC to keep the chosen day */
const formatVisitDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export function PGDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isLoading, isError } = usePGListing(id!);
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const isStudent = user?.role === 'student';

  const toggleSave = useToggleSave();
  const { data: savedData } = useSavedListings({ enabled: isStudent });
  const isSaved = (savedData?.data?.saved ?? []).some((s: { pg?: { _id: string } }) => s.pg?._id === id);

  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  const pg = data?.data.pg;

  // Came from inside the app → go back (keeps their filters); opened directly → go to listings
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/'));

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      addToast({ title: 'Link copied', variant: 'success' });
    } catch {
      addToast({ title: 'Couldn’t copy the link', variant: 'destructive' });
    }
  };

  if (isLoading) return <DetailsSkeleton />;

  if (isError || !pg) {
    return (
      <div className="flex flex-col items-center rounded-[28px] bg-surface px-6 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white">
          <ImageOff className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold">This place isn’t available</h1>
        <p className="mt-1 text-sm text-muted">It may have been removed by the broker.</p>
        <Link to="/" className="mt-5 inline-flex h-11 items-center rounded-2xl bg-ink px-5 text-sm font-medium text-white">
          Browse listings
        </Link>
      </div>
    );
  }

  const owner = typeof pg.owner === 'object' ? pg.owner : undefined;
  const isOwnListing = Boolean(owner && user && owner._id === user._id);

  return (
    <div className="animate-fade-in">
      {/* ── Top bar ── */}
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="flex h-11 items-center gap-2 rounded-2xl bg-surface pl-3 pr-4 text-sm font-medium transition-colors hover:bg-[#ebebee]"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex gap-2">
          <IconButton label="Copy link" onClick={share}>
            <Share2 className="h-[18px] w-[18px]" />
          </IconButton>
          {isStudent && (
            <IconButton id="save-pg-btn" label={isSaved ? 'Remove from saved' : 'Save'} pressed={isSaved} onClick={() => toggleSave.mutate(pg._id)}>
              <Heart className={cn('h-[18px] w-[18px]', isSaved && 'fill-red-500 text-red-500')} />
            </IconButton>
          )}
        </div>
      </div>

      <Gallery pg={pg} onOpen={setGalleryIndex} />

      {/* ── Title ── */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[28px]">{pg.title}</h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm capitalize text-muted">
            <MapPin className="h-4 w-4 shrink-0" />
            {pg.location.address}, {pg.location.city}, {pg.location.state} {pg.location.pincode}
          </p>
        </div>
        {Boolean(pg.ratingAverage) && (
          <a href="#reviews" className="flex shrink-0 items-center gap-2 rounded-2xl bg-surface py-1.5 pl-1.5 pr-3 text-sm">
            <span className="flex items-center gap-1 rounded-xl bg-accent px-2 py-1 font-semibold text-white">
              <Star className="h-3.5 w-3.5 fill-current" />
              {pg.ratingAverage?.toFixed(1)}
            </span>
            <span className="text-muted">
              {pg.numReviews} review{pg.numReviews === 1 ? '' : 's'}
            </span>
          </a>
        )}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* On phones the price + request card comes straight after the title */}
        <aside className="lg:order-last">
          <div className="space-y-4 lg:sticky lg:top-24">
            <PriceCard pg={pg} isOwnListing={isOwnListing} />
            {owner && <BrokerCard pg={pg} owner={owner} showContact={isStudent} />}
          </div>
        </aside>

        <div className="min-w-0 space-y-10">
          <section>
            <SectionTitle>What you get</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact icon={BedDouble} label={roomLabel(pg)} />
              <Fact icon={Users} label={genderLabel(pg)} />
              <Fact
                icon={DoorOpen}
                label={
                  pg.availableRooms <= 0
                    ? 'Currently full'
                    : typeOf(pg) === 'flat'
                      ? 'Available now'
                      : `${pg.availableRooms} of ${pg.totalRooms} rooms free`
                }
              />
              <Fact icon={Wallet} label={pg.deposit ? `${formatRent(pg.deposit)} deposit` : 'No deposit'} />
            </div>
          </section>

          <section>
            <SectionTitle>About this {typeOf(pg) === 'flat' ? 'flat' : 'PG'}</SectionTitle>
            <ExpandableText text={pg.description} />
          </section>

          {pg.amenities.length > 0 && (
            <section>
              <SectionTitle>Facilities</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {pg.amenities.map((a) => {
                  const { label, icon: Icon } = amenityMeta(a);
                  return (
                    <div key={a} className="flex items-center gap-3 rounded-2xl border border-black/[0.06] p-3 text-sm">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface">
                        <Icon className="h-4 w-4" />
                      </span>
                      {label}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <SectionTitle>What’s included in the rent</SectionTitle>
            {(pg.rentIncludes?.length ?? 0) === 0 && !pg.additionalCharges ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                The broker hasn’t listed what the rent covers. Ask about electricity, meals and Wi-Fi when you request a visit.
              </p>
            ) : (
              <div className="space-y-3">
                {(pg.rentIncludes?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pg.rentIncludes!.map((item) => (
                      <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[13px] font-medium capitalize text-emerald-800">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        {item}
                      </span>
                    ))}
                  </div>
                )}
                {pg.additionalCharges && (
                  <p className="text-sm text-muted">
                    <span className="font-medium text-ink">Extra charges: </span>
                    {pg.additionalCharges}
                  </p>
                )}
              </div>
            )}
          </section>

          <section>
            <SectionTitle>Location</SectionTitle>
            <LocationMap pg={pg} />
          </section>

          <section id="reviews" className="scroll-mt-24">
            <ReviewSection pgId={pg._id} />
          </section>
        </div>
      </div>

      <Lightbox images={pg.images} index={galleryIndex} onIndexChange={setGalleryIndex} title={pg.title} />
    </div>
  );
}

/* ─── Gallery ─────────────────────────────────────────────────────────── */

function Gallery({ pg, onOpen }: { pg: PGListing; onOpen: (i: number) => void }) {
  const images = pg.images ?? [];
  const side = images.slice(1, 3);
  const hiddenCount = images.length - 3;

  if (images.length === 0) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center rounded-[28px] bg-surface text-muted sm:h-[380px]">
        <ImageOff className="h-8 w-8" />
        <p className="mt-2 text-sm">No photos yet</p>
      </div>
    );
  }

  return (
    <div className={cn('grid h-[280px] grid-rows-[minmax(0,1fr)] gap-3 sm:h-[400px] lg:h-[460px]', side.length > 0 && 'lg:grid-cols-[2fr_1fr]')}>
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="group relative overflow-hidden rounded-[28px] bg-surface"
        aria-label="View photos"
      >
        <img src={images[0].url} alt={pg.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium backdrop-blur-md">
          {typeLabel(typeOf(pg))}
        </span>
        {images.length > 1 && (
          <span className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-[13px] font-medium backdrop-blur-md">
            <Images className="h-4 w-4" />
            {images.length} photos
          </span>
        )}
      </button>

      {side.length > 0 && (
        <div className={cn('hidden min-h-0 gap-3 lg:grid', side.length === 2 ? 'grid-rows-[repeat(2,minmax(0,1fr))]' : 'grid-rows-[minmax(0,1fr)]')}>
          {side.map((img, i) => (
            <button
              key={img.publicId}
              type="button"
              onClick={() => onOpen(i + 1)}
              className="group relative overflow-hidden rounded-[22px] bg-surface"
              aria-label={`View photo ${i + 2}`}
            >
              <img src={img.url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              {i === side.length - 1 && hiddenCount > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-2xl font-semibold text-white">
                  +{hiddenCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Lightbox({
  images,
  index,
  onIndexChange,
  title,
}: {
  images: PGImage[];
  index: number | null;
  onIndexChange: (i: number | null) => void;
  title: string;
}) {
  const open = index !== null && images.length > 0;
  const i = index ?? 0;
  const step = (d: number) => onIndexChange((i + d + images.length) % images.length);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/90 animate-fade-in" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col font-display text-white outline-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') step(1);
            if (e.key === 'ArrowLeft') step(-1);
          }}
        >
          <div className="flex items-center justify-between p-4">
            <Dialog.Title className="truncate text-sm font-medium">{title}</Dialog.Title>
            <Dialog.Description className="sr-only">Photo gallery</Dialog.Description>
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/70">
                {i + 1} / {images.length}
              </span>
              <Dialog.Close aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-4 pb-6 sm:px-20">
            {open && <img src={images[i].url} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />}
            {images.length > 1 && (
              <>
                <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" aria-label="Next photo" onClick={() => step(1)} className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ─── Price + request ─────────────────────────────────────────────────── */

function PriceCard({ pg, isOwnListing }: { pg: PGListing; isOwnListing: boolean }) {
  const { user } = useAuthStore();
  const isStudent = user?.role === 'student';
  const { data: myRequests } = useStudentInquiries({ enabled: isStudent });
  const previous = ((myRequests?.data?.inquiries ?? []) as Inquiry[]).find(
    (inq) => typeof inq.pg === 'object' && inq.pg?._id === pg._id
  );
  const [composing, setComposing] = useState(false);
  const [sent, setSent] = useState<Inquiry | null>(null);

  const done = sent ?? (composing ? null : previous);

  return (
    <div className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(17,17,17,0.35)]">
      <p className="text-[13px] text-muted">Monthly rent</p>
      <p className="mt-0.5 text-[28px] font-semibold tracking-tight text-accent">
        {formatRent(pg.rent)}
        <span className="text-sm font-normal text-muted"> / month</span>
      </p>

      <dl className="mt-4 divide-y divide-black/[0.06] rounded-2xl bg-surface px-4 text-sm">
        <div className="flex justify-between py-3">
          <dt className="text-muted">Deposit</dt>
          <dd className="font-medium">{pg.deposit ? formatRent(pg.deposit) : 'None'}</dd>
        </div>
        <div className="flex justify-between py-3">
          <dt className="text-muted">Availability</dt>
          <dd className={cn('font-medium', pg.availableRooms <= 0 && 'text-red-600')}>
            {pg.availableRooms <= 0 ? 'Full right now' : typeOf(pg) === 'flat' ? 'Available' : `${pg.availableRooms} rooms free`}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        {isStudent ? (
          done ? (
            <RequestSent inquiry={done} justSent={Boolean(sent)} onAgain={() => { setSent(null); setComposing(true); }} />
          ) : composing ? (
            <RequestForm pg={pg} onCancel={() => setComposing(false)} onSent={(inq) => { setSent(inq); setComposing(false); }} />
          ) : (
            <button
              type="button"
              id="request-visit-btn"
              onClick={() => setComposing(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-medium text-white transition-colors hover:bg-black/85"
            >
              <CalendarDays className="h-4 w-4" />
              Request a visit
            </button>
          )
        ) : isOwnListing ? (
          <Link
            to={`/dashboard/listings/${pg._id}/edit`}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-medium text-white transition-colors hover:bg-black/85"
          >
            <Pencil className="h-4 w-4" />
            Edit your listing
          </Link>
        ) : (
          <p className="rounded-2xl bg-surface px-4 py-3 text-[13px] text-muted">Students can request a visit from this page.</p>
        )}
      </div>
    </div>
  );
}

const todayLocal = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the user's timezone
const stripPhone = (v: string) => v.replace(/[\s-]/g, '');

const requestSchema = z.object({
  message: z.string().trim().min(10, 'Add a few more words (at least 10 characters)').max(500, 'Keep it under 500 characters'),
  phone: z.string().refine((v) => /^\+?[0-9]{10,15}$/.test(stripPhone(v)), 'Enter a valid 10-digit phone number'),
  visitDate: z
    .string()
    .optional()
    .refine((v) => !v || v >= todayLocal(), 'Pick today or a later date'),
});
type RequestData = z.infer<typeof requestSchema>;

function RequestForm({ pg, onSent, onCancel }: { pg: PGListing; onSent: (inq: Inquiry) => void; onCancel: () => void }) {
  const { user } = useAuthStore();
  const createInquiry = useCreateInquiry();
  const brokerName = typeof pg.owner === 'object' ? pg.owner.name?.split(' ')[0] : undefined;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      message: `Hi${brokerName ? ` ${brokerName}` : ''}, I’m interested in ${pg.title}. Is it still available? I’d like to come and see it.`,
      phone: user?.phone ?? '',
      visitDate: '',
    },
  });

  const onSubmit = async ({ message, phone, visitDate }: RequestData) => {
    try {
      const res = await createInquiry.mutateAsync({
        pgId: pg._id,
        message: message.trim(),
        phone: stripPhone(phone),
        visitDate: visitDate || undefined,
      });
      onSent(res.data.inquiry);
    } catch {
      // Shown below via createInquiry.isError
    }
  };

  const inputClass =
    'w-full rounded-2xl border border-transparent bg-surface px-4 text-sm outline-none transition-all placeholder:text-muted/80 focus:border-black/10 focus:bg-white focus:ring-4 focus:ring-black/[0.04]';

  return (
    <form id="request-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="request-visit-date" className="mb-1.5 block text-[13px] font-medium">
          Preferred visit date <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="request-visit-date" type="date" min={todayLocal()} className={cn(inputClass, 'h-12')} {...register('visitDate')} />
        {errors.visitDate && <p className="mt-1.5 text-xs text-red-500">{errors.visitDate.message}</p>}
      </div>
      <div>
        <label htmlFor="request-phone" className="mb-1.5 block text-[13px] font-medium">
          Your phone number
        </label>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input id="request-phone" type="tel" inputMode="tel" placeholder="98765 43210" className={cn(inputClass, 'h-12 pl-11')} {...register('phone')} />
        </div>
        {errors.phone && <p className="mt-1.5 text-xs text-red-500">{errors.phone.message}</p>}
      </div>
      <div>
        <label htmlFor="request-message" className="mb-1.5 block text-[13px] font-medium">
          Message to the broker
        </label>
        <textarea id="request-message" rows={4} className={cn(inputClass, 'resize-none py-3 leading-relaxed')} {...register('message')} />
        {errors.message && <p className="mt-1.5 text-xs text-red-500">{errors.message.message}</p>}
      </div>

      {createInquiry.isError && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {(createInquiry.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Couldn’t send your request. Please try again.'}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-12 rounded-2xl px-4 text-sm font-medium transition-colors hover:bg-surface">
          Cancel
        </button>
        <button
          type="submit"
          id="send-request-btn"
          disabled={createInquiry.isPending}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-60"
        >
          {createInquiry.isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
          Send request
        </button>
      </div>
      <p className="text-center text-xs text-muted">The broker gets your number and message, and replies directly.</p>
    </form>
  );
}

function RequestSent({ inquiry, justSent, onAgain }: { inquiry: Inquiry; justSent: boolean; onAgain: () => void }) {
  return (
    <div className="rounded-2xl bg-emerald-50 p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div className="text-sm">
          <p className="font-semibold text-emerald-900">{justSent ? 'Request sent' : `You asked on ${formatDate(inquiry.createdAt)}`}</p>
          <p className="mt-0.5 text-emerald-800/80">
            {inquiry.visitDate ? `Preferred visit: ${formatVisitDate(inquiry.visitDate)}. ` : ''}
            The broker will contact you on your phone.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-4 pl-8 text-[13px] font-medium">
        <Link to="/dashboard/inquiries" className="text-emerald-900 underline underline-offset-4">
          My requests
        </Link>
        <button type="button" onClick={onAgain} className="text-emerald-900/70 hover:text-emerald-900">
          Send another
        </button>
      </div>
    </div>
  );
}

function BrokerCard({ pg, owner, showContact }: { pg: PGListing; owner: User; showContact: boolean }) {
  const whatsapp = owner.phone
    ? `https://wa.me/${owner.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(
        `Hi, I saw "${pg.title}" on Anei Ghar and I’m interested. Is it still available?`
      )}`
    : undefined;

  return (
    <div className="rounded-[28px] border border-black/[0.06] bg-white p-5">
      <p className="text-[13px] text-muted">Listed by</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
          {getInitials(owner.name || '?')}
        </span>
        <div>
          <p className="text-sm font-semibold">{owner.name}</p>
          <p className="text-[13px] text-muted">Broker / Agent</p>
        </div>
      </div>
      {showContact && whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          id="whatsapp-owner"
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.08] text-sm font-medium transition-colors hover:bg-surface"
        >
          <MessageCircle className="h-4 w-4" />
          Chat on WhatsApp
        </a>
      )}
    </div>
  );
}

/* ─── Small pieces ────────────────────────────────────────────────────── */

function LocationMap({ pg }: { pg: PGListing }) {
  const { lat, lng } = pg.location.coordinates ?? {};
  const hasPin = typeof lat === 'number' && typeof lng === 'number';
  const query = hasPin ? `${lat},${lng}` : encodeURIComponent(`${pg.location.address}, ${pg.location.city}, ${pg.location.state}`);

  return (
    <div className="overflow-hidden rounded-[24px] border border-black/[0.06]">
      <div className="h-72 bg-surface">
        {hasPin && mapsEnabled ? (
          <Map defaultCenter={{ lat, lng }} defaultZoom={15} mapId="pg-detail-map" gestureHandling="cooperative" disableDefaultUI style={{ width: '100%', height: '100%' }}>
            <AdvancedMarker position={{ lat, lng }} title={pg.title} />
          </Map>
        ) : (
          // Keyless embed so the map still works without a Google Maps API key
          <iframe
            title="Map"
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps?q=${query}&z=15&output=embed`}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="truncate text-[13px] capitalize text-muted">
          {pg.location.address}, {pg.location.city}
        </p>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${query}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium hover:underline"
        >
          Open in Maps <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 280;
  return (
    <div>
      <p className={cn('whitespace-pre-line text-sm leading-relaxed text-muted', long && !expanded && 'line-clamp-4')}>{text}</p>
      {long && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-2 text-sm font-medium underline underline-offset-4">
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-lg font-semibold tracking-tight">{children}</h2>;
}

function Fact({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-3 text-sm font-medium">{label}</p>
    </div>
  );
}

function IconButton({
  label,
  pressed,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface transition-colors hover:bg-[#ebebee]"
      {...props}
    />
  );
}

function DetailsSkeleton() {
  return (
    <div>
      <div className="mb-5 h-11 w-24 animate-pulse rounded-2xl bg-surface" />
      <div className="h-[280px] animate-pulse rounded-[28px] bg-surface sm:h-[400px] lg:h-[460px]" />
      <div className="mt-6 h-8 w-2/3 animate-pulse rounded-full bg-surface" />
      <div className="mt-3 h-4 w-1/2 animate-pulse rounded-full bg-surface" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-[28px] bg-surface" />
      </div>
    </div>
  );
}
