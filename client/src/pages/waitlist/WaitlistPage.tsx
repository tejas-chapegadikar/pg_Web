import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, X } from 'lucide-react';
import { waitlistApi } from '@/api/waitlist';
import { homeFor } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo-mark.svg';
import { PhonePreview } from './PhonePreview';

const BRAND_BLUE = '#0046FF';
const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Stand-in room photos until real ones from Jorhat PGs are added
const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=320&h=320&q=70&auto=format&fit=crop`;
const LEFT_PHOTOS = ['1586023492125-27b2c045efd7', '1493809842364-78817add7ffb', '1522708323590-d24dbb6b0267'].map(photo);
const RIGHT_PHOTOS = ['1598928506311-c55ded91a20c', '1616486338812-3dadae4b4ace', '1484154218962-a197022b5858'].map(photo);

/** The front page for visitors who aren't signed in: join the waitlist, or log in */
export function WaitlistPage() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const { addToast } = useUIStore();
  const qc = useQueryClient();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ again: boolean } | null>(null);

  const { data: count } = useQuery({ queryKey: ['waitlist-count'], queryFn: waitlistApi.count, staleTime: 60_000 });
  const join = useMutation({
    mutationFn: waitlistApi.join,
    onSuccess: (res) => {
      qc.setQueryData(['waitlist-count'], res.count);
      setJoined({ again: res.alreadyJoined });
      setEmail('');
    },
    onError: (err) => {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message ?? 'We couldn’t add you just now. Please try again.');
    },
  });

  if (isAuthenticated && user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address, like name@gmail.com');
      return;
    }
    setError(null);
    join.mutate(value);
  };

  const others = count ?? 0;

  return (
    <div className="relative min-h-dvh overflow-clip bg-white font-display text-ink">
      <Swirl />

      <header className="relative z-30 mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-5 sm:px-8 lg:px-12">
        <Link to="/welcome" className="flex items-center gap-2" aria-label="Anei Ghar home">
          <img src={logo} alt="" className="h-8 w-auto" />
          <span className="text-[19px] font-medium tracking-tight" style={{ color: BRAND_BLUE }}>
            anieghar
          </span>
        </Link>
        {/* Keep the page they were trying to open, so signing in can send them back to it */}
        <Link
          to="/login"
          state={location.state}
          id="waitlist-login"
          className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          Login
        </Link>
      </header>

      <main className="relative z-20">
        <section className="mx-auto flex max-w-xl flex-col items-center px-4 pt-6 text-center sm:pt-10">
          {/* The font only comes in one weight; a thin outline gives it the marker look of the design */}
          <h1 className="animate-fade-in font-hand text-[52px] leading-[1.15] [-webkit-text-stroke:1.2px_currentColor] sm:text-[80px] sm:[-webkit-text-stroke:2px_currentColor]">
            Find. Move.
            <br />
            Belong.
          </h1>
          <p className="mt-4 text-sm text-muted">Join the waitlist to find your next stay near college.</p>

          <form onSubmit={submit} noValidate className="mt-6 flex w-full max-w-[460px] flex-col gap-3 sm:flex-row">
            <label htmlFor="waitlist-email" className="sr-only">
              Email address
            </label>
            <input
              id="waitlist-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'waitlist-error' : undefined}
              className={cn(
                'h-14 w-full min-w-0 shrink-0 rounded-full sm:w-auto sm:flex-1 border bg-white px-6 text-[15px] outline-none transition-shadow placeholder:text-muted focus:ring-4 focus:ring-black/[0.06]',
                error ? 'border-red-500' : 'border-ink/70'
              )}
            />
            <button
              type="submit"
              id="waitlist-join"
              disabled={join.isPending}
              className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-8 text-[15px] font-medium text-white transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
            >
              {join.isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              Join the waitlist
            </button>
          </form>
          <p id="waitlist-error" role="alert" className="mt-2 min-h-5 text-[13px] text-red-600">
            {error}
          </p>
          <p className="text-[13px] text-muted">
            {others >= 10 ? `Join ${others} other students` : 'Be one of the first students to join'}
          </p>
        </section>

        {/* Phone preview with room photos on either side */}
        <section aria-label="A preview of the app" className="relative mt-8 flex justify-center pb-24 sm:mt-10">
          <PhotoRow photos={LEFT_PHOTOS} side="left" />
          <PhotoRow photos={RIGHT_PHOTOS} side="right" />

          <div className="relative z-20">
            <PhonePreview photoUrl={photo('1505693416388-ac5ce068fe85').replace('w=320&h=320', 'w=700&h=560')} />
            {joined && (
              <ThanksCard
                again={joined.again}
                onClose={() => setJoined(null)}
                onCopied={() => addToast({ title: 'Link copied', variant: 'success' })}
                onCopyFailed={() => addToast({ title: 'Couldn’t copy the link', variant: 'destructive' })}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * The thick blue line that loops behind the phone, drawn in as the page opens.
 * Phones get a simpler sweep that stays clear of the headline.
 */
function Swirl() {
  const line = (d: string, className: string) => (
    <svg aria-hidden viewBox="0 0 1000 1000" preserveAspectRatio="none" className={cn('pointer-events-none absolute inset-0 z-0 h-full w-full', className)}>
      <path
        d={d}
        fill="none"
        stroke={BRAND_BLUE}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        className="animate-draw stroke-[30px] md:stroke-[56px]"
      />
    </svg>
  );
  return (
    <>
      {line(
        'M -40 420 C 80 400 150 430 175 520 C 205 630 255 690 340 690 C 470 690 560 610 650 575 C 770 530 880 520 925 420 C 965 330 910 250 845 270 C 770 295 790 370 860 360 C 940 350 975 270 1060 220 M 1060 40 C 960 90 860 140 880 175 C 900 205 990 220 1060 250',
        'hidden md:block'
      )}
      {line('M -80 470 C 120 450 170 610 330 640 C 520 675 640 520 780 500 C 900 485 960 530 1080 560', 'md:hidden')}
    </>
  );
}

function PhotoRow({ photos, side }: { photos: string[]; side: 'left' | 'right' }) {
  return (
    <div
      aria-hidden
      className={cn(
        'absolute top-[300px] z-10 hidden gap-12 md:flex',
        // The photo nearest the phone tucks a little behind it
        side === 'left' ? 'right-[calc(50%+120px)] flex-row-reverse' : 'left-[calc(50%+120px)]'
      )}
    >
      {photos.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          style={{ animationDelay: `${i * 0.6}s` }}
          className="animate-float h-[120px] w-[120px] shrink-0 rounded-[22px] object-cover shadow-[0_18px_40px_-14px_rgba(17,17,17,0.45)] ring-4 ring-white"
        />
      ))}
    </div>
  );
}

function ThanksCard({
  again,
  onClose,
  onCopied,
  onCopyFailed,
}: {
  again: boolean;
  onClose: () => void;
  onCopied: () => void;
  onCopyFailed: () => void;
}) {
  const link = window.location.origin;
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      onCopied();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onCopyFailed();
    }
  };

  // Instagram has no web share link: use the phone's share sheet, or copy the link to paste in a story
  const shareInstagram = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Anei Ghar', text: 'Find your next stay near college', url: link });
      } catch {
        // They closed the share sheet
      }
    } else {
      await copy();
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      id="waitlist-thanks"
      className="animate-fade-in absolute left-1/2 top-[300px] z-30 w-[300px] -translate-x-1/2 rounded-[26px] bg-white px-6 pb-6 pt-5 text-center shadow-[0_30px_70px_-20px_rgba(17,17,17,0.45)] sm:w-[320px]"
    >
      <button
        ref={closeRef}
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white transition-transform hover:scale-105"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <p className="text-[13px] font-medium" style={{ color: BRAND_BLUE }}>
        anieghar
      </p>
      <p className="mt-6 text-[22px] font-medium tracking-tight">{again ? 'You’re already in!' : 'Thank you!'}</p>
      <p className="mx-auto mt-2 max-w-[240px] text-[13px] leading-relaxed text-muted">
        {again
          ? 'That email is already on the waitlist. We’ll let you know as soon as we’re live at your college.'
          : 'You’re on the waitlist. We’ll let you know as soon as we’re live at your college.'}
      </p>

      <p className="mt-7 text-[13px] font-medium">Tell your friends</p>
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" onClick={shareInstagram} aria-label="Share on Instagram" className="rounded-lg p-1.5 transition-colors hover:bg-surface">
          <InstagramIcon />
        </button>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on LinkedIn"
          className="rounded-lg p-1.5 transition-colors hover:bg-surface"
        >
          <LinkedInIcon />
        </a>
      </div>

      <div className="mt-3 flex h-12 items-center gap-2 rounded-full bg-ink pl-5 pr-1.5 text-white">
        <span className="min-w-0 flex-1 truncate text-left text-[13px]">{link}</span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy link"
          id="waitlist-copy"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/15"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M20.45 2H3.55A1.55 1.55 0 0 0 2 3.55v16.9C2 21.3 2.7 22 3.55 22h16.9c.85 0 1.55-.7 1.55-1.55V3.55C22 2.7 21.3 2 20.45 2ZM8.06 18.9H5.08V9.36h2.98v9.54ZM6.57 8.05a1.73 1.73 0 1 1 0-3.46 1.73 1.73 0 0 1 0 3.46ZM18.92 18.9h-2.97v-4.64c0-1.1-.02-2.53-1.54-2.53-1.55 0-1.78 1.2-1.78 2.45v4.72H9.66V9.36h2.85v1.3h.04a3.12 3.12 0 0 1 2.81-1.54c3 0 3.56 1.98 3.56 4.55v5.23Z" />
    </svg>
  );
}
