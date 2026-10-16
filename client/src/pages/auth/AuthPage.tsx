import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, BedDouble, KeyRound, MapPin, ShieldCheck, Sofa, Wifi } from 'lucide-react';
import { authApi } from '@/api/auth';
import { homeFor, RoleMismatchError, useAuthenticate } from '@/hooks/useAuth';
import { firebaseErrorMessage, getGoogleIdToken, isFirebaseConfigured } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { buttonClasses } from '@/components/ds/styles';
import logo from '@/assets/logo-mark.svg';
import { ErrorBanner, RoleMismatchBanner, RolePicker } from './authParts';
import { FIREBASE_MISSING, apiMessage, type Mode, type Role } from './authShared';

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  // Set by ProtectedRoute when someone opens a page (e.g. a shared PG link) before signing in
  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from;
  const [role, setRole] = useState<Role>('student');

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    // Opening the bare site URL isn't a real destination — send them to their usual landing page
    const returnTo = from && from.pathname !== '/' ? from.pathname + from.search : homeFor(user.role);
    navigate(returnTo, { replace: true });
  }, [isAuthenticated, user, from, navigate]);

  // ── Google ───────────────────────────────────────────────────────────────
  const google = useAuthenticate();
  const [googleProblem, setGoogleProblem] = useState<string | null>(null);
  const [googleOpening, setGoogleOpening] = useState(false);

  const continueWithGoogle = async () => {
    setGoogleProblem(null);
    google.reset();
    if (!isFirebaseConfigured) {
      setGoogleProblem(`Google sign-in ${FIREBASE_MISSING}`);
      return;
    }
    setGoogleOpening(true);
    try {
      const idToken = await getGoogleIdToken();
      // New Google accounts are created with the role picked above
      google.mutate({ run: () => authApi.googleLogin({ idToken, role }), expectedRole: role });
    } catch (err) {
      setGoogleProblem(firebaseErrorMessage(err));
    } finally {
      setGoogleOpening(false);
    }
  };

  const googleMismatch = google.error instanceof RoleMismatchError ? google.error : null;
  const googleError =
    googleProblem ?? (google.error && !googleMismatch ? apiMessage(google.error, 'Google sign-in failed. Please try again.') : null);

  const isLogin = mode === 'login';
  const busy = googleOpening || google.isPending;

  // Mouse position feeds CSS variables (no re-render): the floating tiles drift, the card's light follows
  const pageRef = useRef<HTMLDivElement>(null);
  const onPagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !pageRef.current) return;
    pageRef.current.style.setProperty('--mx', String(e.clientX / window.innerWidth - 0.5));
    pageRef.current.style.setProperty('--my', String(e.clientY / window.innerHeight - 0.5));
  };
  const onCardPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--sx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--sy', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={pageRef}
      onPointerMove={onPagePointerMove}
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-white px-4 py-6 font-display text-ink sm:bg-backdrop sm:px-6 short:py-4"
    >
      {/* Dotted backdrop that fades out toward the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden sm:block"
        style={{
          backgroundImage: 'radial-gradient(rgba(17,17,17,0.09) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, #000 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, #000 30%, transparent 75%)',
        }}
      />
      {/* Soft background glow so the card doesn't float on a flat gray */}
      <div aria-hidden className="animate-drift pointer-events-none absolute -left-40 -top-40 hidden h-[480px] w-[480px] rounded-full bg-accent/15 blur-3xl sm:block" />
      <div aria-hidden className="animate-drift pointer-events-none absolute -bottom-48 -right-32 hidden h-[520px] w-[520px] rounded-full bg-ink/[0.07] blur-3xl [animation-delay:-6s] sm:block" />

      {/* Little icon tiles floating around the card (big screens), drifting a touch with the mouse */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden xl:block">
        {FLOATERS.map(({ icon: Icon, className, depth, tilt, delay }) => (
          <div
            key={className}
            className={cn('absolute transition-transform duration-700 ease-out', className)}
            style={{ transform: `translate3d(calc(var(--mx, 0) * ${depth}px), calc(var(--my, 0) * ${depth}px), 0)` }}
          >
            <div
              className="animate-float flex h-14 w-14 items-center justify-center rounded-2xl border border-black/[0.05] bg-white shadow-[0_20px_40px_-20px_rgba(15,23,42,0.35)]"
              style={{ '--r': `${tilt}deg`, animationDelay: `${delay}s` } as React.CSSProperties}
            >
              <Icon className="h-6 w-6 text-ink" strokeWidth={1.75} />
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/welcome"
        state={location.state}
        viewTransition
        className="group absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-white hover:text-ink sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" /> Back
      </Link>

      {/* Sign In and Sign Up show the same content, so the card is exactly the same size in both */}
      <main
        onPointerMove={onCardPointerMove}
        className="stagger group/card relative w-full max-w-[460px] sm:rounded-[32px] sm:border sm:border-black/[0.05] sm:bg-white sm:p-9 sm:shadow-[0_40px_90px_-30px_rgba(15,23,42,0.25)] compact:sm:p-7"
      >
        {/* A faint blue light follows the mouse across the card */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/card:opacity-100 sm:block"
          style={{
            background: 'radial-gradient(380px circle at var(--sx, 50%) var(--sy, 0%), rgba(0,70,255,0.07), transparent 60%)',
          }}
        />
        <div style={{ '--i': 0 } as React.CSSProperties} className="flex flex-col items-center text-center">
          {/* Same view-transition-name as the welcome page logo, so it glides here when they press Get started */}
          <span
            style={{ viewTransitionName: 'brand-logo' }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface compact:h-12 compact:w-12"
          >
            <img src={logo} alt="Anei Ghar" className="h-8 w-auto compact:h-7" />
          </span>
          {/* Google is the only way in for now (email + password and email codes are switched off) */}
          <h1 className="mt-4 text-[28px] font-semibold leading-tight tracking-tight compact:mt-3 compact:text-[24px]">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
              {isLogin ? 'Sign in with Google to continue your PG search.' : 'Join Anei Ghar with your Google account in a few seconds.'}
          </p>
        </div>

        {/* Sign In / Sign Up switch */}
        <div style={{ '--i': 1 } as React.CSSProperties} className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 compact:mt-4">
          {(['login', 'register'] as const).map((m) => (
            <Link
              key={m}
              to={m === 'login' ? '/login' : '/register'}
              state={location.state}
              replace
              className={cn(
                'rounded-xl py-2.5 text-center text-sm font-medium transition-all duration-200',
                mode === m ? 'bg-white text-ink shadow-[0_4px_14px_-6px_rgba(17,17,17,0.25)]' : 'text-muted hover:text-ink'
              )}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </Link>
          ))}
        </div>

        <div style={{ '--i': 2 } as React.CSSProperties} className="mt-6 space-y-4 compact:mt-4 compact:space-y-3">
              <RolePicker
                label={isLogin ? 'Sign in as' : 'I am a'}
                value={role}
                onChange={(r) => {
                  setRole(r);
                  setGoogleProblem(null);
                  google.reset();
                }}
              />

              {googleMismatch ? (
                <RoleMismatchBanner
                  actualRole={googleMismatch.actualRole}
                  onSwitch={(r) => {
                    setRole(r);
                    google.reset();
                  }}
                />
              ) : (
                googleError && <ErrorBanner>{googleError}</ErrorBanner>
              )}

              <button
                type="button"
                id="google-btn"
                onClick={continueWithGoogle}
                disabled={busy}
                className={buttonClasses('primary', 'md', 'group h-12 w-full pl-1.5 text-[15px] hover:-translate-y-0.5')}
              >
                <span className="mr-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white">
                  {busy ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-ink" />
                  ) : (
                    <GoogleLogo />
                  )}
                </span>
                {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
                {/* Matches the logo chip so the label stays centred */}
                <span className="ml-auto flex h-9 w-9 items-center justify-center">
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </button>

              <p className="text-center text-[13px] text-muted">
                {isLogin ? 'New here? Signing in creates your account. ' : 'Already joined? '}
                <Link
                  to={isLogin ? '/register' : '/login'}
                  state={location.state}
                  replace
                  className="font-semibold text-ink underline-offset-4 hover:underline"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </Link>
              </p>
        </div>

        <div style={{ '--i': 3 } as React.CSSProperties} className="mt-7 grid grid-cols-3 gap-2 border-t border-black/[0.06] pt-5 compact:mt-5 compact:pt-4">
          {TRUST.map(({ icon: Icon, label }) => (
            <div key={label} className="group flex flex-col items-center gap-1.5 text-center">
              <Icon className="h-4 w-4 text-ink transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
              <span className="text-[11.5px] leading-tight text-muted">{label}</span>
            </div>
          ))}
        </div>
      </main>

      <p className="relative mt-5 max-w-[460px] text-center text-xs leading-relaxed text-muted compact:mt-3">
        We only use your name, email and profile photo from Google.
      </p>
    </div>
  );
}

const TRUST = [
  { icon: BadgeCheck, label: 'Verified listings' },
  { icon: ShieldCheck, label: 'Secure Google sign-in' },
  { icon: MapPin, label: 'Growing across India' },
];

/** Decorative tiles around the card: where they sit, how far they drift with the mouse, their tilt and float timing */
const FLOATERS = [
  { icon: BedDouble, className: 'left-[calc(50%-430px)] top-[18%]', depth: 30, tilt: -8, delay: 0 },
  { icon: Wifi, className: 'left-[calc(50%-370px)] bottom-[20%]', depth: 18, tilt: 6, delay: -2 },
  { icon: KeyRound, className: 'right-[calc(50%-430px)] top-[24%]', depth: 26, tilt: 8, delay: -1 },
  { icon: Sofa, className: 'right-[calc(50%-380px)] bottom-[16%]', depth: 22, tilt: -6, delay: -3 },
];

/** Google's multicolour "G" (as required by Google's sign-in branding guidelines) */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
