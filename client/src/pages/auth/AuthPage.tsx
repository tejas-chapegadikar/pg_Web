import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { homeFor, RoleMismatchError, useAuthenticate } from '@/hooks/useAuth';
import { firebaseErrorMessage, getGoogleIdToken, isFirebaseConfigured } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { buttonClasses } from '@/components/ds/styles';
import logo from '@/assets/logo-mark.svg';
import { ErrorBanner, RoleMismatchBanner, RolePicker } from './authParts';
import { FIREBASE_MISSING, apiMessage, type Mode, type Role } from './authShared';

const unsplash = (id: string) => `https://images.unsplash.com/${id}?w=1400&q=80&auto=format&fit=crop`;

const SLIDES = [
  {
    image: unsplash('photo-1600596542815-ffad4c1539a9'),
    title: 'Find your perfect PG stay',
    text: 'Verified PGs near your college. Compare, enquire and move in, all in a few clicks.',
  },
  {
    image: unsplash('photo-1502672260266-1c1ef2d93688'),
    title: 'Rooms that feel like home',
    text: 'Real photos, honest prices and the amenities you care about. No surprises on move-in day.',
  },
  {
    image: unsplash('photo-1522708323590-d24dbb6b0267'),
    title: 'List & fill rooms faster',
    text: 'Brokers manage every listing and student enquiry from one simple dashboard.',
  },
];

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

  return (
    <div className="min-h-screen bg-white font-display text-ink sm:bg-backdrop sm:p-6 lg:flex lg:items-center lg:justify-center lg:p-6 short:p-4">
      {/* Fills the screen; height comes from the window, not the content, so Sign In and Sign Up are exactly the same size */}
      <div className="mx-auto grid min-h-dvh w-full grid-cols-1 bg-white sm:min-h-[calc(100dvh-3rem)] sm:rounded-[36px] sm:shadow-[0_40px_90px_-30px_rgba(15,23,42,0.25)] lg:h-[calc(100dvh-3rem)] lg:min-h-0 lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:p-4 short:h-[calc(100dvh-2rem)]">
        <HeroPanel />

        <main className="flex min-w-0 flex-col px-5 py-6 compact:py-4 sm:px-10 lg:overflow-y-auto lg:px-10 lg:py-5 short:py-3">
          {/* Logo (mobile only — on desktop it sits on the hero) */}
          <div className="flex justify-center lg:hidden">
            <img src={logo} alt="Anei Ghar" className="h-11 w-auto" />
          </div>

          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-5 compact:py-3 lg:py-3">
            {/* Google is the only way in for now (email + password and email codes are switched off) */}
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[30px] compact:text-[26px]">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              {isLogin ? 'Sign in with Google to continue your PG search.' : 'Join Anei Ghar with your Google account in a few seconds.'}
            </p>

            {/* Tabs */}
            <div className="mt-6 flex gap-8 border-b border-black/[0.06] compact:mt-4">
              {(['login', 'register'] as const).map((m) => (
                <Link
                  key={m}
                  to={m === 'login' ? '/login' : '/register'}
                  state={location.state}
                  replace
                  className={cn(
                    'relative pb-3 text-sm font-medium transition-colors',
                    mode === m ? 'text-ink' : 'text-muted hover:text-ink'
                  )}
                >
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                  {mode === m && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-ink" />}
                </Link>
              ))}
            </div>

            <div className="mt-6 space-y-4 compact:mt-4 compact:space-y-3">
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
                className={buttonClasses('secondary', 'md', 'h-12 w-full text-[15px]')}
              >
                {busy ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-ink" />
                ) : (
                  <GoogleLogo />
                )}
                {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
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

            <p className="mt-8 text-center text-xs leading-relaxed text-muted compact:mt-5">
              We only use your name, email and profile photo from Google.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── Hero carousel (desktop) ─────────────────────────────────────────── */

function HeroPanel() {
  const [index, setIndex] = useState(0);

  // Restarting the timer on every change means a manual pick gets a full 5s too
  useEffect(() => {
    const timer = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), 5000);
    return () => clearTimeout(timer);
  }, [index]);

  const slide = SLIDES[index];

  return (
    <aside className="hidden flex-col lg:flex">
      <div className="relative flex-1 overflow-hidden rounded-[28px] rounded-bl-[80px] bg-surface">
        {SLIDES.map((s, i) => (
          <img
            key={s.image}
            src={s.image}
            alt=""
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-out',
              i === index ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
            )}
          />
        ))}

        <span className="absolute left-5 top-5 rounded-2xl bg-white/90 p-3 backdrop-blur-md">
          <img src={logo} alt="Anei Ghar" className="h-10 w-auto" />
        </span>
      </div>

      <div className="mt-5 flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.image}
            type="button"
            aria-label={`Show slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              'h-[3px] rounded-full transition-all duration-300',
              i === index ? 'w-12 bg-ink' : 'w-8 bg-black/10 hover:bg-black/20'
            )}
          />
        ))}
      </div>

      <div key={index} className="min-h-[130px] animate-fade-in px-4 pb-4 pt-6 short:min-h-[120px] short:pt-4">
        <h2 className="text-[32px] font-semibold leading-[1.15] tracking-tight short:text-[28px]">{slide.title}</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{slide.text}</p>
      </div>
    </aside>
  );
}

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
