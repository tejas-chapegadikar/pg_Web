import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldOff } from 'lucide-react';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import logo from '@/assets/logo-mark.svg';
import { Button } from './ui';
import { ADMIN } from './adminPath';

/** Signed in, but the server says this account isn't an admin (or the server is unreachable) */
export function AccessDenied({ status }: { status?: number }) {
  const { user, logout } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const denied = status === 403;

  const switchAccount = async () => {
    await authApi.logout().catch(() => {});
    logout();
    qc.clear();
    navigate(`${ADMIN}/login`, { replace: true });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-4 font-display text-ink">
      <div className="w-full max-w-sm text-center">
        <img src={logo} alt="" className="mx-auto h-9 w-auto" />
        <span className="mx-auto mt-8 flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.05]">
          <ShieldOff className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-[20px] font-semibold tracking-tight">{denied ? 'No admin access' : 'Couldn’t reach the server'}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          {denied
            ? `${user?.email ?? 'This account'} isn’t an anieghar admin. Sign in with the founder or co-founder account.`
            : 'Check your internet connection and reload the page.'}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {denied ? (
            <Button variant="primary" onClick={switchAccount}>
              Sign in with another account
            </Button>
          ) : (
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate('/')}>
            Go to anieghar
          </Button>
        </div>
      </div>
    </main>
  );
}
