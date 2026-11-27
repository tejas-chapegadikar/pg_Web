import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { adminApi, errorText } from '@/api/admin';
import { useAuthStore } from '@/stores/authStore';
import { firebaseErrorMessage, getGoogleIdToken, isFirebaseConfigured } from '@/lib/firebase';
import logo from '@/assets/logo-mark.svg';
import type { AuthResponse } from '@/types';
import { Button, Field, Input } from './ui';
import { ADMIN } from './adminPath';

/**
 * Sign-in for the admin panel. Uses the normal anieghar accounts (Google or email + password);
 * whether the account is an admin is checked by the server right after.
 */
export function AdminLogin() {
  const { isAuthenticated, setAuth, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'google' | 'password' | null>(null);

  if (isAuthenticated && !busy) return <Navigate to={`${ADMIN}`} replace />;
  const from = (location.state as { from?: string } | null)?.from;

  const finish = async (res: AuthResponse) => {
    setAuth(res.data.user, res.data.accessToken);
    try {
      const me = await adminApi.me();
      qc.setQueryData(['admin-me'], me);
      navigate(from?.startsWith(ADMIN) ? from : ADMIN, { replace: true });
    } catch (err) {
      // Not an admin: don't leave a session open from the admin login
      await authApi.logout().catch(() => {});
      logout();
      qc.clear();
      const status = (err as { response?: { status?: number } }).response?.status;
      setError(status === 403 ? 'You don’t have access to this admin panel.' : errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setError(null);
    setBusy('google');
    try {
      const idToken = await getGoogleIdToken();
      // role is only used if this Google account has never signed in before
      await finish(await authApi.googleLogin({ idToken, role: 'student' }));
    } catch (err) {
      setBusy(null);
      const firebase = (err as { code?: string }).code ? firebaseErrorMessage(err) : errorText(err);
      if (firebase) setError(firebase);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setBusy('password');
    try {
      await finish(await authApi.login({ email: email.trim().toLowerCase(), password }));
    } catch (err) {
      setBusy(null);
      setError(errorText(err, 'Couldn’t sign in. Check your details and try again.'));
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#fafafa] px-4 font-display text-ink">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <img src={logo} alt="" className="h-8 w-auto" />
          <span className="text-[19px] font-medium tracking-tight text-[#0046FF]">anieghar</span>
          <span className="rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-white">Admin</span>
        </div>

        <div className="rounded-2xl border border-black/[0.08] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h1 className="text-[18px] font-semibold tracking-tight">Sign in to the admin panel</h1>
          <p className="mt-1 text-[13px] text-muted">For the anieghar team only.</p>

          {isFirebaseConfigured && (
            <>
              <Button className="mt-5 h-10 w-full" onClick={google} loading={busy === 'google'} disabled={Boolean(busy)} icon={busy === 'google' ? undefined : <GoogleIcon />}>
                Continue with Google
              </Button>
              <div className="my-5 flex items-center gap-3 text-[12px] text-muted">
                <span className="h-px flex-1 bg-black/[0.08]" />
                or
                <span className="h-px flex-1 bg-black/[0.08]" />
              </div>
            </>
          )}

          <form onSubmit={submit} noValidate className="space-y-3.5">
            <Field label="Email" htmlFor="admin-email">
              <Input id="admin-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" htmlFor="admin-password">
              <Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <p role="alert" className="min-h-[18px] text-[12.5px] text-red-600">
              {error}
            </p>
            <Button type="submit" variant="primary" className="h-10 w-full" loading={busy === 'password'} disabled={Boolean(busy)}>
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
