import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, Check, Copy, GraduationCap, Share2, X } from 'lucide-react';
import { waitlistApi, type WaitlistRole } from '@/api/waitlist';
import { homeFor } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo-mark.svg';
import { PhonePreview } from './PhonePreview';

const BRAND_BLUE = '#0046FF';
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const SAVED_KEY = 'anieghar-waitlist'; // remembers a returning visitor already joined

// Stand-in room photos until real ones from Jorhat PGs are added
const photo = (id: string, size = 320) =>
  `https://images.unsplash.com/photo-${id}?w=${size}&h=${size}&q=70&auto=format&fit=crop`;
const LEFT_PHOTOS = ['1586023492125-27b2c045efd7', '1493809842364-78817add7ffb', '1522708323590-d24dbb6b0267'];
const RIGHT_PHOTOS = ['1598928506311-c55ded91a20c', '1616486338812-3dadae4b4ace', '1484154218962-a197022b5858'];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readSaved(): { email: string; role: WaitlistRole } | null {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * The waitlist landing page. Built to fit one screen on any device: the phone preview
 * rises from the bottom edge and is cut off by the screen instead of making the page scroll.
 */
export function WaitlistPage({ showLogin = false }: { showLogin?: boolean }) {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const qc = useQueryClient();

  const [role, setRole] = useState<WaitlistRole>('student');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(readSaved);
  const [thanks, setThanks] = useState<{ again: boolean } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const { data: count } = useQuery({ queryKey: ['waitlist-count'], queryFn: waitlistApi.count, staleTime: 60_000 });
  const join = useMutation({
    mutationFn: waitlistApi.join,
    onSuccess: (res, vars) => {
      qc.setQueryData(['waitlist-count'], res.count);
      setThanks({ again: res.alreadyJoined });
      setSaved(vars);
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(vars));
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

  if (showLogin && isAuthenticated && user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError('That doesn’t look like an email. Try something like name@gmail.com');
      return;
    }
    setError(null);
    join.mutate({ email: value, role });
  };

  // The phone tilts toward the mouse and the photos drift at different depths
  const onPointerMove = (e: React.PointerEvent) => {
    const stage = stageRef.current;
    if (e.pointerType !== 'mouse' || !stage || reducedMotion()) return;
    stage.style.setProperty('--mx', String(e.clientX / window.innerWidth - 0.5));
    stage.style.setProperty('--my', String(e.clientY / window.innerHeight - 0.5));
  };

  return (
    <div
      onPointerMove={onPointerMove}
      className="relative flex h-dvh flex-col overflow-hidden bg-white font-display text-ink"
    >
      <Swirl />

      <header className="relative z-30 flex shrink-0 items-center justify-between px-4 py-3 sm:px-8 sm:py-4 lg:px-12">
        <span className="flex items-center gap-2">
          <img src={logo} alt="" className="h-7 w-auto sm:h-8" />
          <span className="text-[18px] font-medium tracking-tight sm:text-[19px]" style={{ color: BRAND_BLUE }}>
            anieghar
          </span>
        </span>
        {showLogin ? (
          <Link
            to="/login"
            state={location.state}
            className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            Login
          </Link>
        ) : (
          <span className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[12px] font-medium text-ink/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: BRAND_BLUE }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_BLUE }} />
            </span>
            Launching soon
          </span>
        )}
      </header>

      <main className="relative z-20 flex min-h-0 flex-1 flex-col">
        <section className="flex shrink-0 flex-col items-center px-4 pt-[clamp(4px,2vh,28px)] text-center">
          {/* The font has one weight; a thin outline gives it the marker look of the design */}
          <h1 className="animate-fade-in font-hand text-[clamp(40px,7.2vh,60px)] leading-[1.12] [-webkit-text-stroke:1.2px_currentColor] md:text-[clamp(48px,8.5vh,84px)] md:[-webkit-text-stroke:2px_currentColor]">
            Find. Move. <br className="md:hidden" />
            Belong.
          </h1>
          <p className="mt-[clamp(4px,1vh,12px)] max-w-sm text-[13px] text-muted sm:text-sm">
            Verified PGs and flats near your college. Join the waitlist and be first in when we launch.
          </p>

          {saved && !thanks ? (
            <JoinedPanel saved={saved} onShare={() => setThanks({ again: true })} onReset={() => setSaved(null)} />
          ) : (
            <form onSubmit={submit} noValidate className="mt-[clamp(10px,2.2vh,24px)] flex w-full max-w-[480px] flex-col items-center">
              <RolePicker value={role} onChange={setRole} />
              <div className="mt-3 flex w-full flex-col gap-2.5 sm:flex-row">
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby="waitlist-error"
                  className={cn(
                    'h-[clamp(44px,6vh,56px)] w-full min-w-0 shrink-0 rounded-full border bg-white/90 px-6 text-[15px] outline-none backdrop-blur transition-[box-shadow,border-color] placeholder:text-muted focus:border-ink focus:ring-4 focus:ring-[#0046FF]/15 sm:w-auto sm:flex-1',
                    error ? 'border-red-500' : 'border-ink/30'
                  )}
                />
                <button
                  type="submit"
                  id="waitlist-join"
                  disabled={join.isPending}
                  className="group flex h-[clamp(44px,6vh,56px)] shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-7 text-[15px] font-medium text-white shadow-[0_14px_30px_-14px_rgba(17,17,17,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-14px_rgba(0,70,255,0.6)] active:translate-y-0 disabled:opacity-70"
                >
                  {join.isPending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : null}
                  Join the waitlist
                  {!join.isPending && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                </button>
              </div>
              <p id="waitlist-error" role="alert" className="mt-1.5 min-h-[18px] text-[12.5px] text-red-600">
                {error}
              </p>
            </form>
          )}
          <WaitingCount count={count} />
        </section>

        {/* Phone preview, cut off by the bottom of the screen; hidden when the screen is too short */}
        <section
          ref={stageRef}
          aria-label="Preview of the app"
          className="relative mt-[clamp(8px,2vh,24px)] min-h-0 flex-1 [@media(max-height:520px)]:hidden"
        >
          <PhotoRow ids={LEFT_PHOTOS} side="left" />
          <PhotoRow ids={RIGHT_PHOTOS} side="right" />
          <div
            className="absolute left-1/2 top-0 z-20 transition-transform duration-300 ease-out"
            style={{
              transform:
                'translateX(-50%) perspective(1200px) rotateY(calc(var(--mx, 0) * 10deg)) rotateX(calc(var(--my, 0) * -6deg))',
            }}
          >
            <PhonePreview />
          </div>
          {/* Soft fade where the phone meets the bottom edge */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-white to-transparent" />
        </section>
      </main>

      {thanks && <ThanksDialog again={thanks.again} onClose={() => setThanks(null)} />}
    </div>
  );
}

function RolePicker({ value, onChange }: { value: WaitlistRole; onChange: (r: WaitlistRole) => void }) {
  const options = [
    { value: 'student' as const, label: 'I’m a student', icon: GraduationCap },
    { value: 'owner' as const, label: 'I list PGs / flats', icon: Building2 },
  ];
  return (
    <div role="radiogroup" aria-label="I am joining as" className="relative grid grid-cols-2 rounded-full bg-surface p-1 text-[13px] font-medium">
      {/* Sliding highlight behind the chosen option */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-[0_4px_14px_-6px_rgba(17,17,17,0.3)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: value === 'owner' ? 'translateX(100%)' : 'none' }}
      />
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          id={`waitlist-role-${v}`}
          onClick={() => onChange(v)}
          className={cn(
            'relative z-10 flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 transition-colors sm:px-5',
            value === v ? 'text-ink' : 'text-muted hover:text-ink'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Shown instead of the form to someone who already joined from this browser */
function JoinedPanel({ saved, onShare, onReset }: { saved: { email: string }; onShare: () => void; onReset: () => void }) {
  return (
    <div className="animate-fade-in mt-[clamp(10px,2.2vh,24px)] flex w-full max-w-[480px] flex-col items-center gap-3">
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
        <button
          type="button"
          id="waitlist-share-again"
          onClick={onShare}
          className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 font-medium text-white transition-transform hover:-translate-y-0.5"
        >
          <Share2 className="h-4 w-4" /> Invite friends
        </button>
        <button type="button" onClick={onReset} className="text-muted underline-offset-4 hover:text-ink hover:underline">
          Use another email
        </button>
      </div>
    </div>
  );
}

/** "Join 120 other students", counting up; an honest line until there are 10 real sign-ups */
function WaitingCount({ count }: { count?: number }) {
  const [shown, setShown] = useState(0);
  const [still] = useState(reducedMotion);
  useEffect(() => {
    if (!count || count < 10 || still) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setShown(Math.round(count * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [count, still]);

  return (
    <p className="text-[12.5px] text-muted">
      {count && count >= 10 ? (
        <>
          Join <span className="font-semibold tabular-nums text-ink">{still ? count : shown}</span> others already waiting
        </>
      ) : (
        'Be one of the first to join'
      )}
    </p>
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
        className="animate-draw stroke-[26px] lg:stroke-[48px]"
      />
    </svg>
  );
  return (
    <>
      {line(
        'M -40 560 C 80 545 150 600 180 700 C 210 800 270 880 370 880 C 490 880 570 810 650 780 C 770 735 880 720 925 600 C 965 500 905 420 840 445 C 770 470 790 545 860 535 C 940 525 975 440 1060 390 M 1060 50 C 960 100 860 150 880 185 C 900 215 990 230 1060 260',
        'hidden lg:block'
      )}
      {line('M -80 700 C 120 680 170 820 330 840 C 520 865 640 740 780 730 C 900 720 960 760 1080 780', 'lg:hidden')}
    </>
  );
}

function PhotoRow({ ids, side }: { ids: string[]; side: 'left' | 'right' }) {
  const dir = side === 'left' ? -1 : 1;
  return (
    <div
      aria-hidden
      className={cn(
        'absolute top-[clamp(40px,12vh,120px)] z-10 hidden gap-[clamp(20px,3vw,48px)] transition-transform duration-500 ease-out md:flex',
        // The photo nearest the phone tucks a little behind it
        side === 'left' ? 'right-[calc(50%+110px)] flex-row-reverse' : 'left-[calc(50%+110px)]'
      )}
      style={{ transform: `translate(calc(var(--mx, 0) * ${dir * 24}px), calc(var(--my, 0) * 16px))` }}
    >
      {ids.map((id, i) => (
        <img
          key={id}
          src={photo(id)}
          alt=""
          loading="lazy"
          style={{ animationDelay: `${i * 0.7}s` }}
          className="animate-float h-[clamp(84px,13vh,120px)] w-[clamp(84px,13vh,120px)] shrink-0 rounded-[22px] object-cover shadow-[0_18px_40px_-14px_rgba(17,17,17,0.45)] ring-4 ring-white transition-transform duration-300 hover:scale-110"
        />
      ))}
    </div>
  );
}

function ThanksDialog({ again, onClose }: { again: boolean; onClose: () => void }) {
  const { addToast } = useUIStore();
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
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      addToast({ title: 'Couldn’t copy the link', variant: 'destructive' });
      return false;
    }
  };

  // Instagram and WhatsApp on phones: the share sheet. Instagram on a computer: copy the link to paste.
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
      {!reducedMotion() && <Confetti />}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="waitlist-thanks-title"
        id="waitlist-thanks"
        className="animate-pop relative w-full max-w-[340px] rounded-[28px] bg-white px-6 pb-6 pt-5 text-center shadow-[0_40px_90px_-24px_rgba(17,17,17,0.5)] ring-1 ring-black/5"
      >
        <button
          ref={closeRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white transition-transform hover:scale-105"
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
          <span className="min-w-0 flex-1 truncate text-left text-[13px]">{link.replace(/^https?:\/\//, '')}</span>
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
  const className =
    'flex h-11 w-11 items-center justify-center rounded-2xl bg-surface transition-all hover:-translate-y-0.5 hover:bg-[#ebebee]';
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

/** A short burst of blue and dark paper bits behind the thank-you card */
function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => {
    const angle = (i / 36) * Math.PI * 2;
    const distance = 160 + ((i * 47) % 140);
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 60,
      r: (i * 73) % 360,
      color: [BRAND_BLUE, '#111111', '#7ea0ff', '#ffb020'][i % 4],
      delay: (i % 6) * 25,
    };
  });
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="animate-confetti absolute h-2.5 w-1.5 rounded-[2px]"
          style={
            {
              backgroundColor: p.color,
              animationDelay: `${p.delay}ms`,
              '--cx': `${p.x}px`,
              '--cy': `${p.y}px`,
              '--cr': `${p.r}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
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
