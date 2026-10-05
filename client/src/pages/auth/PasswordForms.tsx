import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, Lock, Mail, User as UserIcon } from 'lucide-react';
import { RoleMismatchError, useForgotPassword, useLogin, useRegister, useSendSignupCode } from '@/hooks/useAuth';
import { Button } from '@/components/ds/Button';
import { Field } from '@/components/ds/Field';
import { OtpInput } from '@/components/ds/OtpInput';
import { ErrorBanner, RoleMismatchBanner, RolePicker } from './authParts';
import { apiMessage, apiStatus, type Role } from './authShared';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type LoginData = z.infer<typeof loginSchema>;

// The server requires 8+ characters (server/models/User.js)
const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(1, 'Repeat your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
type RegisterData = z.infer<typeof registerSchema>;

interface FormProps {
  role: Role;
  onRoleChange: (role: Role) => void;
}

const formClass = 'mt-5 space-y-4 compact:mt-4 compact:space-y-3';
const stepClass = 'space-y-4 compact:space-y-3';
const iconClass = 'h-[18px] w-[18px]';
const RESEND_SECONDS = 30;

export function LoginForm({ role, onRoleChange, onForgot }: FormProps & { onForgot: () => void }) {
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
      className={formClass}
    >
      <RolePicker label="Sign in as" value={role} onChange={changeRole} />

      {mismatch ? (
        <RoleMismatchBanner actualRole={mismatch.actualRole} onSwitch={changeRole} />
      ) : (
        login.isError && <ErrorBanner>{apiMessage(login.error, 'Invalid credentials. Please try again.')}</ErrorBanner>
      )}

      <Field
        id="login-email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        icon={<Mail className={iconClass} />}
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
        icon={<Lock className={iconClass} />}
        error={errors.password?.message}
        {...register('password')}
      />

      <Button type="submit" id="login-submit" loading={login.isPending} className="w-full">
        Sign In
      </Button>
    </form>
  );
}

/**
 * Sign-up in two steps: the details, then the 6-digit code we email to that address.
 * The account is only created once the code checks out; after that the password is enough.
 */
export function RegisterForm({ role, onRoleChange }: FormProps) {
  const location = useLocation();
  const sendCode = useSendSignupCode();
  const createAccount = useRegister();
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [codeFor, setCodeFor] = useState<string | null>(null); // the address the latest code went to
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string>();
  const [cooldown, setCooldown] = useState(0);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const emailCode = (email: string) =>
    sendCode.mutate(email, {
      onSuccess: (res) => {
        setCodeFor(email);
        setCode('');
        setDevCode(res.devCode);
        setCooldown(RESEND_SECONDS);
        createAccount.reset();
        setStep('code');
      },
    });

  const toCodeStep = ({ email }: RegisterData) => {
    const address = email.trim().toLowerCase();
    // Back from "Change" without touching the email: the code already sent still works
    if (address === codeFor) setStep('code');
    else emailCode(address);
  };

  const verify = (value = code) => {
    if (!codeFor || value.length !== 6 || createAccount.isPending) return;
    const { name, password } = getValues();
    createAccount.mutate({ name: name.trim(), email: codeFor, password, role, code: value });
  };

  const emailTaken = apiStatus(sendCode.error) === 409;
  const codeProblem = createAccount.error ?? sendCode.error;

  return (
    <div className={formClass}>
      <RolePicker label="I am a" value={role} onChange={onRoleChange} />

      {step === 'code' && codeFor ? (
        <form
          id="register-code-form"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          className={stepClass}
        >
          {codeProblem && <ErrorBanner>{apiMessage(codeProblem, 'Something went wrong. Please try again.')}</ErrorBanner>}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3 compact:mb-1">
              <p className="truncate text-[13px] font-medium">
                Code sent to <span className="text-muted">{codeFor}</span>
              </p>
              <button
                type="button"
                id="register-change"
                onClick={() => {
                  setStep('details');
                  sendCode.reset();
                  createAccount.reset();
                }}
                className="shrink-0 text-[13px] font-medium text-muted hover:text-ink"
              >
                Change
              </button>
            </div>
            <OtpInput
              value={code}
              onChange={(value) => {
                setCode(value);
                if (createAccount.isError) createAccount.reset();
              }}
              onComplete={verify}
              disabled={createAccount.isPending}
              invalid={createAccount.isError}
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
              {devCode ? (
                // Only in local development, before an email server is configured (see server/.env)
                <button
                  type="button"
                  id="register-dev-code"
                  onClick={() => {
                    setCode(devCode);
                    verify(devCode);
                  }}
                  className="truncate text-left text-amber-700"
                  title="Email isn’t set up on this computer yet, so the code is shown here"
                >
                  Email not set up · code <span className="font-semibold">{devCode}</span>
                </button>
              ) : (
                <span className="truncate text-muted">Check your inbox (and spam)</span>
              )}
              {cooldown > 0 ? (
                <span className="shrink-0 text-muted">Resend in {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  id="register-resend"
                  onClick={() => emailCode(codeFor)}
                  disabled={sendCode.isPending}
                  className="shrink-0 font-medium hover:underline"
                >
                  Resend code
                </button>
              )}
            </div>
          </div>
          <Button type="submit" id="register-verify" loading={createAccount.isPending} disabled={code.length !== 6} className="w-full">
            Verify & create account
          </Button>
        </form>
      ) : (
        <form id="register-form" onSubmit={handleSubmit(toCodeStep)} className={stepClass}>
          {sendCode.isError && (
            <ErrorBanner>
              {emailTaken ? (
                <>
                  An account with this email already exists.{' '}
                  <Link to="/login" state={location.state} replace className="font-semibold underline">
                    Sign in instead
                  </Link>
                </>
              ) : (
                apiMessage(sendCode.error, 'Couldn’t send the code. Please try again.')
              )}
            </ErrorBanner>
          )}

          <div className="grid gap-4 compact:gap-3 sm:grid-cols-2 sm:gap-3">
            <Field
              id="register-name"
              label="Full name"
              autoComplete="name"
              placeholder="Your name"
              icon={<UserIcon className={iconClass} />}
              error={errors.name?.message}
              {...register('name')}
            />
            <Field
              id="register-email"
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@mail.com"
              icon={<Mail className={iconClass} />}
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
              icon={<Lock className={iconClass} />}
              error={errors.password?.message}
              {...register('password')}
            />
            <Field
              id="register-confirm-password"
              label="Confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              icon={<Lock className={iconClass} />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>

          <Button type="submit" id="register-submit" loading={sendCode.isPending} className="w-full">
            Create Account
          </Button>
        </form>
      )}
    </div>
  );
}

export function ForgotPassword({ onBack }: { onBack: () => void }) {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState('');

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
            if (email.trim()) forgotPassword.mutate(email.trim());
          }}
          className="space-y-5"
        >
          <Field
            id="reset-email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            icon={<Mail className={iconClass} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          {forgotPassword.isError && (
            <ErrorBanner>{apiMessage(forgotPassword.error, 'Failed to send reset email. Please try again.')}</ErrorBanner>
          )}
          <Button type="submit" id="send-reset-btn" loading={forgotPassword.isPending} className="w-full">
            Send Reset Link
          </Button>
        </form>
      )}
    </div>
  );
}
