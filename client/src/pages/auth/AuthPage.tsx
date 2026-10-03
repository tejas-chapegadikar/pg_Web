import { forwardRef, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import { homeFor, useForgotPassword, useLogin, useRegister, RoleMismatchError } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import type { User } from '@/types';
import logo from '@/assets/logo-dark.png';

type Role = User['role'];
type Mode = 'login' | 'register';

const ROLES = [
  { value: 'student', title: 'Student', description: 'Browse PGs & send enquiries', icon: GraduationCap },
  { value: 'owner', title: 'Broker / Agent', description: 'List PGs & manage enquiries', icon: Briefcase },
] as const;

const ROLE_LABEL: Record<Role, string> = { student: 'Student', owner: 'Broker / Agent' };

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

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type LoginData = z.infer<typeof loginSchema>;

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(6, 'At least 6 characters'),
    confirmPassword: z.string().min(6, 'At least 6 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
type RegisterData = z.infer<typeof registerSchema>;

const apiMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;


export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  // Set by ProtectedRoute when someone opens a page (e.g. a shared PG link) before signing in
  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from;
  const [role, setRole] = useState<Role>('student');
  const [forgotMode, setForgotMode] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    // Opening the bare site URL isn't a real destination — send them to their usual landing page
    const returnTo = from && from.pathname !== '/' ? from.pathname + from.search : homeFor(user.role);
    navigate(returnTo, { replace: true });
  }, [isAuthenticated, user, from, navigate]);

  const isLogin = mode === 'login';
  const showForgot = forgotMode && isLogin;

  return (
    <div className="min-h-screen bg-white font-display text-ink sm:bg-backdrop sm:p-6 lg:flex lg:items-center lg:justify-center lg:p-6 short:p-4">
      {/* Fixed card height (not content-driven) so Sign In and Sign Up are exactly the same size */}
      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 bg-white sm:min-h-[calc(100dvh-3rem)] sm:rounded-[36px] sm:shadow-[0_40px_90px_-30px_rgba(15,23,42,0.25)] lg:h-[min(780px,calc(100dvh-3rem))] lg:min-h-0 lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:p-4 short:h-[calc(100dvh-2rem)]">
        <HeroPanel />

        <main className="flex min-w-0 flex-col px-5 py-6 compact:py-4 sm:px-10 lg:overflow-y-auto lg:px-10 lg:py-5 short:py-3">
          {/* Logo (mobile only — on desktop it sits on the hero) */}
          <div className="flex justify-center lg:hidden">
            <img src={logo} alt="Anei Ghar" className="h-10 w-auto" />
          </div>

          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-5 compact:py-3 lg:py-3">
            {showForgot ? (
              <ForgotPassword onBack={() => setForgotMode(false)} />
            ) : (
              <>
                <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[30px] compact:text-[26px]">
                  {isLogin ? 'Welcome back' : 'Create account'}
                </h1>
                <p className="mt-1.5 text-sm text-muted compact:hidden">
                  {isLogin ? 'Sign in to continue your PG search.' : 'Join Anei Ghar in less than a minute.'}
                </p>

                {/* Tabs */}
                <div className="mt-6 flex gap-8 border-b compact:mt-4 border-black/[0.06]">
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

                {isLogin ? (
                  <LoginForm role={role} onRoleChange={setRole} onForgot={() => setForgotMode(true)} />
                ) : (
                  <RegisterForm role={role} onRoleChange={setRole} />
                )}

                {/* Divider */}
                <div className="my-4 compact:my-3 flex items-center gap-4 text-xs text-muted">
                  <span className="h-px flex-1 bg-black/[0.07]" />
                  or
                  <span className="h-px flex-1 bg-black/[0.07]" />
                </div>

                <button
                  type="button"
                  id="auth-phone-btn"
                  onClick={() => navigate('/phone-login')}
                  className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border compact:h-11 border-black/[0.08] bg-white text-sm font-medium transition-colors hover:bg-surface"
                >
                  <Phone className="h-4 w-4" />
                  Continue with phone number
                </button>

                <p className="mt-5 text-center text-[13px] text-muted compact:mt-3">
                  {isLogin ? 'New to Anei Ghar? ' : 'Already have an account? '}
                  <Link
                    to={isLogin ? '/register' : '/login'}
                    state={location.state}
                    replace
                    className="font-semibold text-ink underline-offset-4 hover:underline"
                  >
                    {isLogin ? 'Create an account' : 'Sign in'}
                  </Link>
                </p>
              </>
            )}
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

        <span className="absolute left-5 top-5 rounded-2xl bg-white/90 px-3 py-2 backdrop-blur-md">
          <img src={logo} alt="Anei Ghar" className="h-8 w-auto" />
        </span>

        <span className="absolute right-5 top-5 rounded-xl bg-black/40 px-3 py-1.5 text-white backdrop-blur-md">
          <span className="text-base font-semibold">{String(index + 1).padStart(2, '0')}</span>
          <span className="text-xs text-white/70">/{String(SLIDES.length).padStart(2, '0')}</span>
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

/* ─── Forms ───────────────────────────────────────────────────────────── */

interface FormProps {
  role: Role;
  onRoleChange: (role: Role) => void;
}

function LoginForm({ role, onRoleChange, onForgot }: FormProps & { onForgot: () => void }) {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({ resolver: zodResolver(loginSchema) });

  const mismatch = login.error instanceof RoleMismatchError ? login.error : null;

  const changeRole = (r: Role) => {
    onRoleChange(r);
    login.reset();
  };

  return (
    <form
      id="login-form"
      onSubmit={handleSubmit((data) => login.mutate({ ...data, expectedRole: role }))}
      className="mt-5 space-y-4 compact:mt-4 compact:space-y-3"
    >
      <RolePicker label="Sign in as" value={role} onChange={changeRole} />

      {mismatch ? (
        <ErrorBanner>
          This account is registered as a {ROLE_LABEL[mismatch.actualRole]}.{' '}
          <button type="button" onClick={() => changeRole(mismatch.actualRole)} className="font-semibold underline">
            Sign in as {ROLE_LABEL[mismatch.actualRole]}
          </button>
        </ErrorBanner>
      ) : (
        login.isError && <ErrorBanner>{apiMessage(login.error, 'Invalid credentials. Please try again.')}</ErrorBanner>
      )}

      <Field
        id="login-email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        icon={<Mail className="h-[18px] w-[18px]" />}
        error={errors.email?.message}
        {...register('email')}
      />
      <Field
        id="login-password"
        label="Password"
        labelAction={
          <button
            type="button"
            id="forgot-password-btn"
            onClick={onForgot}
            className="text-[13px] font-medium text-muted transition-colors hover:text-ink"
          >
            Forgot password?
          </button>
        }
        type="password"
        autoComplete="current-password"
        placeholder="Enter your password"
        icon={<Lock className="h-[18px] w-[18px]" />}
        error={errors.password?.message}
        {...register('password')}
      />

      <PrimaryButton type="submit" id="login-submit" loading={login.isPending}>
        Sign In
      </PrimaryButton>
    </form>
  );
}

function RegisterForm({ role, onRoleChange }: FormProps) {
  const register_ = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  return (
    <form
      id="register-form"
      onSubmit={handleSubmit(({ name, email, password }) => register_.mutate({ name, email, password, role }))}
      className="mt-5 space-y-4 compact:mt-4 compact:space-y-3"
    >
      <RolePicker label="I am a" value={role} onChange={onRoleChange} />

      {register_.isError && (
        <ErrorBanner>{apiMessage(register_.error, 'Registration failed. Please try again.')}</ErrorBanner>
      )}

      <div className="grid gap-4 compact:gap-3 sm:grid-cols-2 sm:gap-3">
        <Field
          id="register-name"
          label="Full name"
          autoComplete="name"
          placeholder="Your name"
          icon={<UserIcon className="h-[18px] w-[18px]" />}
          error={errors.name?.message}
          {...register('name')}
        />
        <Field
          id="register-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@mail.com"
          icon={<Mail className="h-[18px] w-[18px]" />}
          error={errors.email?.message}
          {...register('email')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          id="register-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          icon={<Lock className="h-[18px] w-[18px]" />}
          error={errors.password?.message}
          {...register('password')}
        />
        <Field
          id="register-confirm-password"
          label="Confirm"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          icon={<Lock className="h-[18px] w-[18px]" />}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
      </div>

      <PrimaryButton type="submit" id="register-submit" loading={register_.isPending}>
        Create Account
      </PrimaryButton>
    </form>
  );
}

function ForgotPassword({ onBack }: { onBack: () => void }) {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState('');

  const send = () => {
    if (email.trim()) forgotPassword.mutate(email.trim());
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </button>
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Reset password</h1>
        <p className="mt-1.5 text-sm text-muted">We'll email you a link to set a new one.</p>
      </div>

      {forgotPassword.isSuccess ? (
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3.5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Reset link sent</p>
            <p className="mt-0.5 text-sm text-emerald-800/80">Check your inbox (and spam folder).</p>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="space-y-5"
        >
          <Field
            id="reset-email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            icon={<Mail className="h-[18px] w-[18px]" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          {forgotPassword.isError && (
            <ErrorBanner>{apiMessage(forgotPassword.error, 'Failed to send reset email. Please try again.')}</ErrorBanner>
          )}
          <PrimaryButton type="submit" id="send-reset-btn" loading={forgotPassword.isPending}>
            Send Reset Link
          </PrimaryButton>
        </form>
      )}
    </div>
  );
}

/* ─── Building blocks ─────────────────────────────────────────────────── */

function RolePicker({ label, value, onChange }: { label: string; value: Role; onChange: (role: Role) => void }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-3">
        {ROLES.map(({ value: r, title, description, icon: Icon }) => {
          const selected = value === r;
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={selected}
              id={`role-${r}`}
              onClick={() => onChange(r)}
              className={cn(
                'relative flex flex-col items-start gap-2.5 rounded-[22px] border bg-white p-4 text-left compact:p-3.5 short:flex-row short:items-center short:gap-3 short:p-3 short:pr-10 transition-all duration-200',
                selected
                  ? 'border-ink shadow-[0_14px_30px_-16px_rgba(17,17,17,0.45)]'
                  : 'border-black/[0.07] hover:border-black/20'
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                  selected ? 'bg-ink text-white' : 'bg-surface text-ink'
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted compact:hidden">{description}</span>
              </span>
              <span
                className={cn(
                  'absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
                  selected ? 'border-accent bg-accent text-white' : 'border-black/15'
                )}
              >
                {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Shown at the right of the label row, e.g. "Forgot password?" */
  labelAction?: React.ReactNode;
  icon: React.ReactNode;
  error?: string;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(({ label, labelAction, icon, error, id, type, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between compact:mb-1">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted">{icon}</span>
        <input
          ref={ref}
          id={id}
          type={isPassword && visible ? 'text' : type}
          aria-invalid={Boolean(error)}
          className={cn(
            'h-12 w-full rounded-2xl border border-transparent bg-surface compact:h-11 pl-13 pr-5 text-sm outline-none transition-all duration-200',
            'placeholder:text-muted/80 focus:border-black/10 focus:bg-white focus:ring-4 focus:ring-black/[0.04]',
            isPassword && 'pr-13',
            error && 'border-red-300 bg-red-50/50'
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted transition-colors hover:text-ink"
          >
            {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
});
Field.displayName = 'Field';

function PrimaryButton({
  loading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink compact:h-11 text-sm font-medium text-white shadow-[0_14px_28px_-14px_rgba(17,17,17,0.7)] transition-all duration-200 hover:bg-black/85 active:scale-[0.99] disabled:opacity-60"
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
      {children}
    </button>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{children}</div>;
}
