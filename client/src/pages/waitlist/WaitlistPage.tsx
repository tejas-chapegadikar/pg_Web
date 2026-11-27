import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, ChevronDown, Copy, PartyPopper, Share2, X } from 'lucide-react';
import { waitlistApi, type WaitlistCounts } from '@/api/waitlist';
import { platformApi } from '@/api/platform';
import { ADMIN } from '@/pages/admin/adminPath';
import { homeFor } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo-mark.svg';
import { PhonePreview } from './PhonePreview';

const BRAND_BLUE = '#0046FF';
// The link people share, whichever address they opened the page on
const SITE_URL = 'https://www.anieghar.com';
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const SAVED_KEY = 'anieghar-waitlist'; // remembers a returning visitor already joined

// Stand-in room photos until real ones from Jorhat PGs are added
const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=240&h=240&q=70&auto=format&fit=crop`;
// Placed beside the phone: distance out from its edge, and height from its middle
// drift: how far below its spot the photo starts before scrolling lifts it in (different per photo = depth)
const TILES = [
  { id: '1586023492125-27b2c045efd7', side: -1, out: 70, up: -150, drift: 110, tilt: -6 },
  { id: '1493809842364-78817add7ffb', side: -1, out: 70, up: 30, drift: 200, tilt: 5 },
  { id: '1598928506311-c55ded91a20c', side: 1, out: 70, up: -110, drift: 160, tilt: 6 },
  { id: '1616486338812-3dadae4b4ace', side: 1, out: 70, up: 70, drift: 240, tilt: -5 },
];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readSaved(): { email: string } | null {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * The waitlist landing page: a first screen with the number of students waiting and the form,
 * then the app preview. Scrolling draws the blue line in, eases the first screen away, and
 * lifts the phone and room photos into place (all switched off for reduced motion).
 */
export function WaitlistPage({ showLogin = false }: { showLogin?: boolean }) {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const qc = useQueryClient();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(readSaved);
  const [thanks, setThanks] = useState<{ again: boolean } | null>(null);
  const [already, setAlready] = useState(false);
  const [phoneIndex, setPhoneIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);

  const { data: counts } = useQuery({ queryKey: ['waitlist-counts'], queryFn: waitlistApi.counts, staleTime: 30_000 });
  // Announcement and message text, set in Admin → Settings
  const { data: platform } = useQuery({ queryKey: ['platform'], queryFn: platformApi.get, staleTime: 30_000 });
  const join = useMutation({
    mutationFn: waitlistApi.join,
    onSuccess: ({ alreadyJoined, ...latest }, vars) => {
      qc.setQueryData(['waitlist-counts'], latest);
      // Joining again isn't a mistake: a friendly note in place of the form, not the thank-you window
      if (alreadyJoined) setAlready(true);
      else setThanks({ again: false });
      setSaved({ email: vars.email });
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify({ email: vars.email }));
      } catch {
        // Private browsing: they just won't be remembered
      }
      setEmail('');
    },
    onError: (err) => {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message ?? 'We couldn’t add you just now. Check your internet and try again.');
    },
  });

  // --p: how much of the blue line is drawn (grows as you scroll)
  // --s: how far the app preview has come into view (0 = just below the screen, 1 = filling it)
  // The phone is also scaled to fit its screen.
  useEffect(() => {
    const root = rootRef.current;
    const area = areaRef.current;
    const phone = phoneRef.current;
    const preview = previewRef.current;
    if (!root || !area || !phone || !preview) return;
    const still = reducedMotion();
    let frame = 0;

    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 1;
      root.style.setProperty('--p', still ? '1' : (0.4 + 0.6 * progress).toFixed(4));
      const top = preview.getBoundingClientRect().top;
      const s = Math.min(1, Math.max(0, 1 - top / window.innerHeight));
      root.style.setProperty('--s', still ? '1' : s.toFixed(4));

      const a = area.getBoundingClientRect();
      const scale = Math.min(0.85, (a.height - 16) / phone.offsetHeight, (a.width - 24) / phone.offsetWidth);
      root.style.setProperty('--phone-scale', scale.toFixed(4));
      root.style.setProperty('--phone-w', `${Math.round(phone.offsetWidth * scale)}px`);
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    request();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
    };
  }, []);

  if (showLogin && isAuthenticated && user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError('That doesn’t look like an email. Try something like name@gmail.com');
      return;
    }
    setError(null);
    join.mutate({ email: value, role: 'student' });
  };

  return (
    <div
      ref={rootRef}
      className="relative overflow-x-clip bg-white font-display text-ink"
      style={{ '--p': 0.4, '--s': 0, '--phone-scale': 0.8, '--phone-w': '256px' } as React.CSSProperties}
    >
      <Swirl />

      {/* ── First screen ── */}
      <section className="relative z-20 flex min-h-dvh flex-col">
        <header className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-8 sm:py-4 lg:px-12">
          <span className="flex items-center gap-2">
            <img src={logo} alt="" className="h-7 w-auto sm:h-8" />
            <span className="text-[18px] font-medium tracking-tight sm:text-[19px]" style={{ color: BRAND_BLUE }}>
              anieghar
            </span>
          </span>
          {showLogin ? (
            <Link to="/login" state={location.state} className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-ink">
              Login
            </Link>
          ) : (
            <span className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[12px] font-medium text-ink/80">
              <Dot /> Launching soon
            </span>
          )}
        </header>

        {platform?.announcement && (
          <p className="mx-auto max-w-[90%] rounded-full bg-surface px-4 py-1.5 text-center text-[12.5px] font-medium text-ink/80">
            {platform.announcement}
          </p>
        )}

        {/* Drifts up and fades a little as the app preview scrolls in */}
        <div
          className="flex flex-1 flex-col items-center justify-center px-4 pb-6 text-center will-change-transform"
          style={{
            opacity: 'calc(1 - var(--s) * 0.75)',
            transform: 'translateY(calc(var(--s) * -56px)) scale(calc(1 - var(--s) * 0.05))',
          }}
        >
          {/* The font has one weight; a thin outline gives it the marker look of the design */}
          <h1 className="font-hand text-[clamp(40px,7vh,58px)] leading-[1.1] [-webkit-text-stroke:1.2px_currentColor] md:text-[clamp(52px,8.5vh,84px)] md:[-webkit-text-stroke:2px_currentColor]">
            Find. Move. <br className="md:hidden" />
            Belong.
          </h1>

          <BigCount counts={counts} message={platform?.waitlistMessage} className="mt-[clamp(12px,3vh,32px)]" />

          <div className="mt-[clamp(16px,3vh,32px)] flex w-full flex-col items-center">
            {saved && !thanks ? (
              <JoinedPanel
                saved={saved}
                already={already}
                onShare={() => setThanks({ again: true })}
                onReset={() => {
                  setSaved(null);
                  setAlready(false);
                }}
              />
            ) : (
              <JoinForm
                email={email}
                onEmail={(v) => {
                  setEmail(v);
                  if (error) setError(null);
                }}
                error={error}
                pending={join.isPending}
                onSubmit={submit}
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => previewRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' })}
            className="mt-[clamp(6px,2vh,24px)] flex flex-col items-center gap-0.5 text-[12.5px] text-muted transition-colors hover:text-ink"
          >
            See the app
            <ChevronDown className="animate-nudge h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ── App preview: the whole phone on one screen ── */}
      <section ref={previewRef} aria-label="Preview of the app" className="relative z-10 flex h-dvh flex-col px-4 pb-4 pt-6">
        <div ref={areaRef} className="relative min-h-0 w-full flex-1">
          {TILES.map((t) => (
            <img
              key={t.id}
              aria-hidden
              src={photo(t.id)}
              alt=""
              loading="lazy"
              className="absolute left-1/2 top-1/2 z-10 hidden h-[clamp(76px,12vh,112px)] w-[clamp(76px,12vh,112px)] rounded-[22px] object-cover shadow-[0_18px_40px_-14px_rgba(17,17,17,0.45)] ring-4 ring-white md:block"
              style={{
                // Its spot beside the phone, plus a lift-in that differs per photo (parallax)
                transform: `translate(calc(-50% + ${t.side} * (var(--phone-w) / 2 + ${t.out}px)), calc(-50% + ${t.up}px * var(--phone-scale) + (1 - var(--s)) * ${t.drift}px)) rotate(calc((1 - var(--s)) * ${t.tilt}deg))`,
                opacity: 'calc(var(--s) * 1.4 - 0.2)',
              }}
            />
          ))}
          {/* The phone rises and grows into place */}
          <div
            className="absolute left-1/2 top-1/2 z-20 will-change-transform"
            style={{
              transform: 'translate(-50%, calc(-50% + (1 - var(--s)) * 90px)) scale(calc(var(--phone-scale) * (0.88 + var(--s) * 0.12)))',
            }}
          >
            <PhonePreview ref={phoneRef} index={phoneIndex} onIndexChange={setPhoneIndex} />
          </div>
        </div>
        <p className="relative z-20 shrink-0 pt-3 text-center text-[12px] text-muted">
          © {new Date().getFullYear()} anieghar · Student stays, made simple
          {/* For the team only; the server decides who actually gets in */}
          <Link to={ADMIN} className="ml-2 text-[11px] text-muted/50 transition-colors hover:text-ink">
            Admin
          </Link>
        </p>
      </section>

      {thanks && <ThanksDialog again={thanks.again} onClose={() => setThanks(null)} />}
    </div>
  );
}

function Dot() {
  return <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_BLUE }} />;
}

/**
 * The headline number. Stays blank (but keeps its space) until the real count arrives,
 * then races up from 1 to it in well under a second.
 */
function BigCount({ counts, message, className }: { counts?: WaitlistCounts; message?: string; className?: string }) {
  const loaded = counts !== undefined;
  const target = counts?.students ?? 0;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!loaded) return;
    let frame = 0;
    if (reducedMotion() || target <= 1) {
      frame = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(frame);
    }
    // From 1 on first load; from the current number when it changes later (e.g. after joining)
    const from = shown > 0 ? shown : 1;
    const duration = 700;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Only re-run when the real number changes; `shown` is just where to count from
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, target]);

  return (
    <div className={cn('flex flex-col items-center', !loaded && 'invisible', className)} aria-live="polite" aria-busy={!loaded}>
      <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
        <Dot /> Live count
      </p>
      <p
        className="mt-1 font-semibold leading-none tracking-[-0.04em] tabular-nums text-[clamp(64px,13vh,132px)]"
        style={{ color: BRAND_BLUE }}
      >
        {(loaded ? shown : 0).toLocaleString('en-IN')}
      </p>
      <p className="mt-2 text-[15px] font-medium sm:text-[17px]">
        {message || `${target === 1 ? 'student is' : 'students are'} already on the waitlist`}
      </p>
    </div>
  );
}

function JoinForm({
  email,
  onEmail,
  error,
  pending,
  onSubmit,
}: {
  email: string;
  onEmail: (v: string) => void;
  error: string | null;
  pending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full max-w-[480px] flex-col items-center">
      <div className="flex w-full flex-col gap-2.5 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="send"
          placeholder="Your email address"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby="waitlist-error"
          className={cn(
            'h-[clamp(46px,6vh,56px)] w-full min-w-0 shrink-0 rounded-full border bg-white px-6 text-[15px] outline-none transition-[box-shadow,border-color] placeholder:text-muted focus:border-ink focus:ring-4 focus:ring-[#0046FF]/15 sm:w-auto sm:flex-1',
            error ? 'border-red-500' : 'border-ink/30'
          )}
        />
        <button
          type="submit"
          id="waitlist-join"
          disabled={pending}
          className="flex h-[clamp(46px,6vh,56px)] shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-7 text-[15px] font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-70"
        >
          {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
          Join the waitlist
          {!pending && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
      <p id="waitlist-error" role="alert" className="mt-1.5 min-h-[18px] text-[12.5px] text-red-600">
        {error}
      </p>
    </form>
  );
}

/** Shown instead of the form to someone who already joined from this browser */
function JoinedPanel({ saved, already, onShare, onReset }: { saved: { email: string }; already?: boolean; onShare: () => void; onReset: () => void }) {
  if (already) {
    return (
      <div className="flex w-full max-w-[480px] flex-col items-center gap-3" role="status">
        <div
          className="animate-fade-in flex w-full items-center gap-3.5 rounded-3xl bg-[#0046FF]/[0.06] px-4 py-3.5 text-left ring-1 ring-[#0046FF]/15"
        >
          <span className="animate-pop flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-[0_8px_20px_-8px_rgba(0,70,255,0.8)]" style={{ backgroundColor: BRAND_BLUE }}>
            <PartyPopper className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[14.5px] font-semibold">You’re already on the waitlist</span>
            <span className="block text-[12.5px] leading-snug text-muted">
              <span className="font-medium text-ink/75">{saved.email}</span> is saved. We’ll write to you as soon as we launch.
            </span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-[13px]">
          <button type="button" onClick={onShare} className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 font-medium text-white transition-colors hover:bg-black/85">
            <Share2 className="h-4 w-4" /> Invite friends
          </button>
          <button type="button" onClick={onReset} className="text-muted underline-offset-4 hover:text-ink hover:underline">
            Use another email
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-full max-w-[480px] flex-col items-center gap-3">
      <div className="flex w-full items-center gap-3 rounded-full bg-surface py-2 pl-2 pr-5 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: BRAND_BLUE }}>
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
        <span className="min-w-0 text-[13px]">
          <span className="block font-medium">You’re on the waitlist</span>
          <span className="block truncate text-muted">{saved.email}</span>
        </span>
      </div>
      <div className="flex items-center gap-4 text-[13px]">
        <button type="button" onClick={onShare} className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 font-medium text-white transition-colors hover:bg-black/85">
          <Share2 className="h-4 w-4" /> Invite friends
        </button>
        <button type="button" onClick={onReset} className="text-muted underline-offset-4 hover:text-ink hover:underline">
          Use another email
        </button>
      </div>
    </div>
  );
}

/**
 * The thick blue line. Most of it is there when the page opens; scrolling draws the rest
 * in behind the phone.
 */
function Swirl() {
  const line = (d: string, className: string) => (
    <svg aria-hidden viewBox="0 0 1000 1000" preserveAspectRatio="none" className={cn('pointer-events-none absolute inset-0 z-0 h-full w-full', className)}>
      <path
        d="M 1060 40 C 930 90 860 150 900 200 C 940 245 1010 230 1060 250"
        fill="none"
        stroke={BRAND_BLUE}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="stroke-[22px] lg:stroke-[44px]"
      />
      <path
        d={d}
        fill="none"
        stroke={BRAND_BLUE}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        className="stroke-[26px] transition-[stroke-dashoffset] duration-300 ease-out lg:stroke-[48px]"
        style={{ strokeDasharray: 1, strokeDashoffset: 'calc(1 - var(--p))' }}
      />
    </svg>
  );
  return (
    <>
      {line('M -60 300 C 110 300 190 420 240 530 C 300 660 520 760 720 720 C 880 690 940 620 1060 580', 'hidden lg:block')}
      {line('M -80 480 C 120 520 140 640 300 700 C 500 770 700 660 1080 700', 'lg:hidden')}
    </>
  );
}

function ThanksDialog({ again, onClose }: { again: boolean; onClose: () => void }) {
  const { addToast } = useUIStore();
  const link = SITE_URL;
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Keep the page still behind the window
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      addToast({ title: 'Couldn’t copy the link', variant: 'destructive' });
      return false;
    }
  };

  // Instagram has no web share link: the phone's share sheet, or copy the link to paste in a story
  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'anieghar', text: 'Find your next stay near college. Join the waitlist:', url: link });
      } catch {
        // They closed the share sheet
      }
    } else if (await copy()) {
      addToast({ title: 'Link copied', description: 'Paste it in your Instagram story or bio.', variant: 'success' });
    }
  };

  const message = encodeURIComponent(`Found this for college stays, join the waitlist: ${link}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-white/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="waitlist-thanks-title"
        id="waitlist-thanks"
        className="animate-fade-in relative w-full max-w-[340px] rounded-[28px] bg-white px-6 pb-6 pt-5 text-center shadow-[0_40px_90px_-24px_rgba(17,17,17,0.5)] ring-1 ring-black/5"
      >
        <button
          ref={closeRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <p className="text-[13px] font-medium" style={{ color: BRAND_BLUE }}>
          anieghar
        </p>
        <span className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ backgroundColor: BRAND_BLUE }}>
          <Check className="h-7 w-7" strokeWidth={3} />
        </span>
        <h2 id="waitlist-thanks-title" className="mt-3 text-[22px] font-semibold tracking-tight">
          {again ? 'You’re on the list' : 'Thank you!'}
        </h2>
        <p className="mx-auto mt-1.5 max-w-[250px] text-[13px] leading-relaxed text-muted">
          {again
            ? 'Your email is already saved. We’ll let you know as soon as we’re live at your college.'
            : 'You’re on the waitlist. We’ll let you know as soon as we’re live at your college.'}
        </p>

        <p className="mt-6 text-[13px] font-medium">Tell your friends</p>
        <div className="mt-2.5 flex justify-center gap-2.5">
          <ShareButton label="WhatsApp" href={`https://wa.me/?text=${message}`}>
            <WhatsAppIcon />
          </ShareButton>
          <ShareButton label="Instagram" onClick={shareNative}>
            <InstagramIcon />
          </ShareButton>
          <ShareButton label="LinkedIn" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`}>
            <LinkedInIcon />
          </ShareButton>
        </div>

        <div className="mt-4 flex h-12 items-center gap-2 rounded-full bg-ink pl-5 pr-1.5 text-white">
          <span className="min-w-0 flex-1 truncate text-left text-[13px]">{link.replace(/^https:\/\//, '')}</span>
          <button
            type="button"
            onClick={copy}
            id="waitlist-copy"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-[12.5px] font-medium transition-colors hover:bg-white/25"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareButton({ label, href, onClick, children }: { label: string; href?: string; onClick?: () => void; children: React.ReactNode }) {
  const className = 'flex h-11 w-11 items-center justify-center rounded-2xl bg-surface transition-colors hover:bg-[#ebebee]';
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${label}`} title={label} className={className}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} aria-label={`Share on ${label}`} title={label} className={className}>
      {children}
    </button>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 1 1 6.98 3.86Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z" />
    </svg>
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
