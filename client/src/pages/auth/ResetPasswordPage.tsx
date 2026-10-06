import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import { useResetPassword } from '@/hooks/useAuth';
import { Button } from '@/components/ds/Button';
import { Field } from '@/components/ds/Field';
import { buttonClasses } from '@/components/ds/styles';
import logo from '@/assets/logo-mark.svg';
import { ErrorBanner } from './authParts';
import { apiMessage } from './authShared';

// The server requires 8+ characters (server/models/User.js)
const schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(1, 'Repeat your new password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const resetPassword = useResetPassword();
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      setErrorMsg('This reset link is incomplete. Ask for a new one from the sign-in page.');
      return;
    }
    setErrorMsg('');
    try {
      await resetPassword.mutateAsync({ token, password: data.password });
      setSuccess(true);
    } catch (err) {
      setErrorMsg(apiMessage(err, 'Couldn’t reset your password. The link may have expired — ask for a new one.'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-backdrop p-4 font-display text-ink">
      <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-[0_40px_90px_-30px_rgba(15,23,42,0.25)] animate-fade-in sm:p-8">
        <img src={logo} alt="Anei Ghar" className="h-11 w-auto" />
        <h1 className="mt-6 text-[28px] font-semibold tracking-tight">{success ? 'Password updated' : 'Set a new password'}</h1>
        <p className="mt-1 text-sm text-muted">
          {success ? 'You can sign in with your new password now.' : 'Pick something you haven’t used before.'}
        </p>

        {success ? (
          <div className="mt-6 space-y-5">
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-sm text-emerald-900">Your password has been changed.</p>
            </div>
            <Link to="/login" className={buttonClasses('primary', 'md', 'w-full')}>
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" id="reset-password-form">
            {errorMsg && <ErrorBanner>{errorMsg}</ErrorBanner>}
            <Field
              id="reset-password-new"
              label="New password"
              type="password"
              autoComplete="new-password"
              placeholder="8+ characters"
              icon={<Lock className="h-[18px] w-[18px]" />}
              error={errors.password?.message}
              {...register('password')}
            />
            <Field
              id="reset-password-confirm"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              icon={<Lock className="h-[18px] w-[18px]" />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Button type="submit" id="reset-submit-btn" loading={isSubmitting} className="w-full">
              Save new password
            </Button>
            <Link to="/login" className="flex items-center justify-center gap-1.5 pt-1 text-[13px] font-medium text-muted hover:text-ink">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
