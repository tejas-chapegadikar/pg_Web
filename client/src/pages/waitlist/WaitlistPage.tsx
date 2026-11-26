import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, Check, ChevronDown, Copy, GraduationCap, Share2, X } from 'lucide-react';
import { waitlistApi, type WaitlistCounts, type WaitlistRole } from '@/api/waitlist';
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
const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=240&h=240&q=70&auto=format&fit=crop`;
// Placed around the phone: distance out from its edge, and height from its middle
const TILES = [
  { id: '1586023492125-27b2c045efd7', side: -1, out: 95, up: -190 },
  { id: '1493809842364-78817add7ffb', side: -1, out: 175, up: -10 },
  { id: '1522708323590-d24dbb6b0267', side: -1, out: 85, up: 170 },
  { id: '1598928506311-c55ded91a20c', side: 1, out: 85, up: -170 },
  { id: '1616486338812-3dadae4b4ace', side: 1, out: 175, up: 10 },
  { id: '1484154218962-a197022b5858', side: 1, out: 95, up: 190 },
];

const STEPS = [
  { word: 'Find.', text: 'Verified PGs, flats and rooms near your college, with real photos and rent.' },
  { word: 'Move.', text: 'Request a visit in one tap. The owner calls you back, no middlemen.' },
  { word: 'Belong.', text: 'Honest reviews from students who have lived there before you.' },
];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readSaved(): { email: string; role: WaitlistRole } | null {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * The waitlist landing page, in three parts:
 * 1. one screen with the headline, the number of students waiting and the form,
 * 2. a scroll story: the phone stays put while the blue line flows under it and photos fly in,
 * 3. the number again with a second form.
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
  const [step, setStep] = useState(0);
  const [phoneIndex, setPhoneIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);

  const { data: counts } = useQuery({ queryKey: ['waitlist-counts'], queryFn: waitlistApi.counts, staleTime: 30_000 });
  const join = useMutation({
    mutationFn: waitlistApi.join,
    onSuccess: ({ alreadyJoined, ...latest }, vars) => {
      qc.setQueryData(['waitlist-counts'], latest);
      setThanks({ again: alreadyJoined });
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

  // Scroll drives everything through CSS variables, so nothing re-renders while scrolling:
  // --p how far down the page (draws the blue line), --fly how far through the phone story
  useEffect(() => {
    const root = rootRef.current;
    const scene = sceneRef.current;
    const area = areaRef.current;
    const phone = phoneRef.current;
    if (!root || !scene || !area || !phone) return;
    const still = reducedMotion();
    let lastStep = -1;
    let frame = 0;

    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      // Drawn a little ahead of the bottom of the screen, so the line is always there behind the phone
      const page = still ? 1 : Math.min(1, (window.scrollY + vh) / document.documentElement.scrollHeight + 0.12);
      const box = scene.getBoundingClientRect();
      const s = Math.min(1, Math.max(0, -box.top / Math.max(1, box.height - vh)));
      root.style.setProperty('--p', page.toFixed(4));
      root.style.setProperty('--fly', still ? '1' : s.toFixed(4));

      // The phone is drawn at full size and scaled to fit the space it has (never above 85%)
      const a = area.getBoundingClientRect();
      const scale = Math.min(0.85, (a.height - 16) / phone.offsetHeight, (a.width - 24) / phone.offsetWidth);
      root.style.setProperty('--phone-scale', scale.toFixed(4));
      root.style.setProperty('--phone-w', `${Math.round(phone.offsetWidth * scale)}px`);

      const next = s < 0.34 ? 0 : s < 0.67 ? 1 : 2;
      if (next !== lastStep) {
        lastStep = next;
        setStep(next);
        setPhoneIndex(next);
      }
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
    join.mutate({ email: value, role });
  };

  // The phone leans a little toward the mouse
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || reducedMotion()) return;
    rootRef.current?.style.setProperty('--mx', (e.clientX / window.innerWidth - 0.5).toFixed(3));
    rootRef.current?.style.setProperty('--my', (e.clientY / window.innerHeight - 0.5).toFixed(3));
  };

  const joinBlock = (idPrefix: string) =>
    saved && !thanks ? (
      <JoinedPanel saved={saved} onShare={() => setThanks({ again: true })} onReset={() => setSaved(null)} />
    ) : (
      <JoinForm
        idPrefix={idPrefix}
        role={role}
        onRole={setRole}
        email={email}
        onEmail={(v) => {
          setEmail(v);
          if (error) setError(null);
        }}
        error={error}
        pending={join.isPending}
        onSubmit={submit}
      />
    );

  return (
    <div
      ref={rootRef}
      onPointerMove={onPointerMove}
      className="relative overflow-x-clip bg-white font-display text-ink"
      style={{ '--p': 0, '--fly': 0, '--phone-scale': 0.8, '--phone-w': '256px' } as React.CSSProperties}
    >
      <Swirl />

      {/* ── 1. First screen ── */}
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
              <LiveDot /> Launching soon
            </span>
          )}
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-6 text-center">
          {/* The font has one weight; a thin outline gives it the marker look of the design */}
          <h1 className="animate-fade-in font-hand text-[clamp(40px,7vh,58px)] leading-[1.1] [-webkit-text-stroke:1.2px_currentColor] md:text-[clamp(52px,8.5vh,84px)] md:[-webkit-text-stroke:2px_currentColor]">
            Find. Move. <br className="md:hidden" />
            Belong.
          </h1>

          <BigCount counts={counts} className="mt-[clamp(10px,2.5vh,28px)]" />

          <div className="mt-[clamp(12px,2.5vh,28px)] flex w-full flex-col items-center">{joinBlock('waitlist')}</div>

          <button
            type="button"
            onClick={() => sceneRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' })}
            className="group mt-[clamp(6px,2vh,24px)] flex flex-col items-center gap-0.5 text-[12.5px] text-muted transition-colors hover:text-ink"
          >
            See how it works
            <ChevronDown className="h-5 w-5 animate-bounce" />
          </button>
        </div>
      </section>

      {/* ── 2. Scroll story: the phone holds still while the line and photos move ── */}
      <section ref={sceneRef} aria-label="How it works" className="relative z-10 h-[300dvh]">
        <div className="sticky top-0 flex h-dvh flex-col items-center gap-3 px-4 pb-4 pt-[clamp(12px,3vh,32px)] lg:flex-row lg:gap-8 lg:px-12 lg:py-8">
          <StepCaption step={step} />
          <div ref={areaRef} className="relative min-h-0 w-full flex-1 self-stretch">
            {TILES.map((t, i) => (
              <FlyingPhoto key={t.id} tile={t} order={i % 3} />
            ))}
            <div
              className="absolute left-1/2 top-1/2 z-20 will-change-transform"
              style={{
                transform:
                  'translate(-50%, -50%) perspective(1400px) rotateY(calc(var(--mx, 0) * 10deg)) rotateX(calc(var(--my, 0) * -6deg)) rotate(calc((1 - min(1, var(--fly) * 5)) * -5deg)) scale(calc(var(--phone-scale) * (0.9 + 0.1 * min(1, var(--fly) * 5))))',
              }}
            >
              <PhonePreview ref={phoneRef} index={phoneIndex} onIndexChange={setPhoneIndex} />
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. The number again, and a second chance to join ── */}
      <section className="relative z-20 flex min-h-dvh flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[560px] rounded-[32px] bg-white px-5 py-8 text-center shadow-[0_40px_90px_-40px_rgba(17,17,17,0.35)] ring-1 ring-black/5 sm:px-10 sm:py-12">
          <p className="font-hand text-[34px] leading-tight [-webkit-text-stroke:1px_currentColor] sm:text-[44px]">Don’t miss your room.</p>
          <BigCount counts={counts} className="mt-4" />
          <div className="mt-6 flex flex-col items-center">{joinBlock('waitlist-end')}</div>
        </div>
        <p className="mt-8 text-[12px] text-muted">© {new Date().getFullYear()} anieghar · Student stays, made simple</p>
      </section>

      {thanks && <ThanksDialog again={thanks.again} onClose={() => setThanks(null)} />}
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: BRAND_BLUE }} />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_BLUE }} />
    </span>
  );
}

/** The headline number: how many students are waiting, counting up when it comes into view */
function BigCount({ counts, className }: { counts?: WaitlistCounts; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const target = counts?.students ?? 0;

  useEffect(() => {
    const el = ref.current;
    if (!el || !target) return;
    let frame = 0;
    const run = () => {
      if (reducedMotion()) {
        frame = requestAnimationFrame(() => setShown(target));
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1400);
        setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        io.disconnect();
        run();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return (
    <div ref={ref} className={cn('flex flex-col items-center', className)} aria-live="polite">
      {target > 0 ? (
        <>
          <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
            <LiveDot /> Live count
          </p>
          <p
            className="mt-1 font-semibold leading-none tracking-[-0.04em] tabular-nums text-[clamp(64px,13vh,132px)]"
            style={{ color: BRAND_BLUE }}
          >
            {shown.toLocaleString('en-IN')}
          </p>
          <p className="mt-2 text-[15px] font-medium sm:text-[17px]">
            {target === 1 ? 'student is' : 'students are'} already on the waitlist
          </p>
          {Boolean(counts?.owners) && (
            <p className="mt-0.5 text-[12.5px] text-muted">
              + {counts!.owners} PG {counts!.owners === 1 ? 'owner' : 'owners'} ready to list rooms
            </p>
          )}
        </>
      ) : (
        <>
          <p className="font-semibold leading-none tracking-tight text-[clamp(30px,5vh,44px)]" style={{ color: BRAND_BLUE }}>
            Be the first student
          </p>
          <p className="mt-2 text-[15px] text-muted">on the waitlist for your college</p>
        </>
      )}
    </div>
  );
}

function JoinForm({
  idPrefix,
  role,
  onRole,
  email,
  onEmail,
  error,
  pending,
  onSubmit,
}: {
  idPrefix: string;
  role: WaitlistRole;
  onRole: (r: WaitlistRole) => void;
  email: string;
  onEmail: (v: string) => void;
  error: string | null;
  pending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full max-w-[480px] flex-col items-center">
      <RolePicker idPrefix={idPrefix} value={role} onChange={onRole} />
      <div className="mt-3 flex w-full flex-col gap-2.5 sm:flex-row">
        <label htmlFor={`${idPrefix}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${idPrefix}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="send"
          placeholder="Your email address"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={`${idPrefix}-error`}
          className={cn(
            'h-[clamp(46px,6vh,56px)] w-full min-w-0 shrink-0 rounded-full border bg-white/90 px-6 text-[15px] outline-none backdrop-blur transition-[box-shadow,border-color] placeholder:text-muted focus:border-ink focus:ring-4 focus:ring-[#0046FF]/15 sm:w-auto sm:flex-1',
            error ? 'border-red-500' : 'border-ink/30'
          )}
        />
        <button
          type="submit"
          id={`${idPrefix}-join`}
          disabled={pending}
          className="group flex h-[clamp(46px,6vh,56px)] shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-7 text-[15px] font-medium text-white shadow-[0_14px_30px_-14px_rgba(17,17,17,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-14px_rgba(0,70,255,0.6)] active:translate-y-0 disabled:opacity-70"
        >
          {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
          Join the waitlist
          {!pending && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
        </button>
      </div>
      <p id={`${idPrefix}-error`} role="alert" className="mt-1.5 min-h-[18px] text-[12.5px] text-red-600">
        {error}
      </p>
    </form>
  );
}

function RolePicker({ idPrefix, value, onChange }: { idPrefix: string; value: WaitlistRole; onChange: (r: WaitlistRole) => void }) {
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
          id={`${idPrefix}-role-${v}`}
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
    <div className="animate-fade-in flex w-full max-w-[480px] flex-col items-center gap-3">
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
          onClick={onShare}
          className="waitlist-share-again flex h-10 items-center gap-2 rounded-full bg-ink px-5 font-medium text-white transition-transform hover:-translate-y-0.5"
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

/** Find / Move / Belong, changing as the visitor scrolls through the phone story */
function StepCaption({ step }: { step: number }) {
  const { word, text } = STEPS[step];
  return (
    <div className="z-30 w-full max-w-[400px] shrink-0 rounded-[24px] bg-white px-5 py-3 text-center lg:w-[360px] lg:rounded-[28px] lg:p-7 lg:text-left">
      <div className="flex items-center justify-center gap-1.5 lg:justify-start" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s.word} className="h-1 w-8 overflow-hidden rounded-full bg-black/10">
            <span className={cn('block h-full rounded-full transition-all duration-500', i <= step ? 'w-full' : 'w-0')} style={{ backgroundColor: BRAND_BLUE }} />
          </span>
        ))}
      </div>
      <div key={step} className="animate-fade-in" aria-live="polite">
        <p className="mt-2 font-hand text-[clamp(32px,5.5vh,64px)] leading-tight [-webkit-text-stroke:1px_currentColor] lg:mt-4 lg:[-webkit-text-stroke:1.6px_currentColor]">
          {word}
        </p>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted lg:mt-2 lg:text-[16px]">{text}</p>
      </div>
    </div>
  );
}

/** A room photo that flies in from the side, in turn, as the story scrolls (tablets and up) */
function FlyingPhoto({ tile, order }: { tile: (typeof TILES)[number]; order: number }) {
  const s = tile.side;
  return (
    <img
      aria-hidden
      src={photo(tile.id)}
      alt=""
      loading="lazy"
      className="absolute left-1/2 top-1/2 z-10 hidden h-[clamp(76px,12vh,112px)] w-[clamp(76px,12vh,112px)] rounded-[22px] object-cover opacity-[var(--t)] shadow-[0_18px_40px_-14px_rgba(17,17,17,0.45)] ring-4 ring-white md:block"
      style={
        {
          '--t': `clamp(0, calc(var(--fly) * 4.5 - ${order * 0.45}), 1)`,
          transform: `translate(calc(-50% + ${s} * (var(--phone-w) / 2 + ${tile.out}px) + (1 - var(--t)) * ${s * 260}px), calc(-50% + ${tile.up}px * var(--phone-scale))) rotate(calc((1 - var(--t)) * ${s * 24}deg)) scale(calc(0.7 + 0.3 * var(--t)))`,
        } as React.CSSProperties
      }
    />
  );
}

/**
 * The thick blue line that winds down the whole page. It draws itself as you scroll,
 * so it seems to flow under the phone while the phone stays still.
 */
function Swirl() {
  const line = (d: string, className: string) => (
    <svg aria-hidden viewBox="0 0 1000 1000" preserveAspectRatio="none" className={cn('pointer-events-none absolute inset-0 z-0 h-full w-full', className)}>
      {/* Small flourish at the top right, drawn once on load */}
      <path
        d="M 1060 25 C 930 55 860 90 900 120 C 940 145 1010 135 1060 145"
        fill="none"
        stroke={BRAND_BLUE}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        className="animate-draw stroke-[22px] lg:stroke-[44px]"
      />
      <path
        d={d}
        fill="none"
        stroke={BRAND_BLUE}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        className="stroke-[26px] transition-[stroke-dashoffset] duration-500 ease-out lg:stroke-[48px]"
        style={{ strokeDasharray: 1, strokeDashoffset: 'calc(1 - var(--p))' }}
      />
    </svg>
  );
  return (
    <>
      {line(
        'M -60 120 C 100 115 170 160 190 200 C 215 250 120 290 260 320 C 450 360 800 300 820 380 C 840 460 300 440 230 520 C 160 600 760 590 800 660 C 840 730 300 720 380 800 C 440 860 800 850 1060 900',
        'hidden lg:block'
      )}
      {line(
        'M -80 190 C 120 195 300 235 240 290 C 180 350 900 330 860 420 C 820 510 120 480 160 580 C 200 680 880 640 840 740 C 800 830 300 860 1080 960',
        'lg:hidden'
      )}
    </>
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
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 1 1 6.98 3.86Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.230-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z" />
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
