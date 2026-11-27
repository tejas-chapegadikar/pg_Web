import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, BarChart3, Building2, LayoutGrid, ListChecks, LogOut, Menu, Settings, Users, X } from 'lucide-react';
import { authApi } from '@/api/auth';
import { adminApi } from '@/api/admin';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo-mark.svg';
import { useAdmin } from './adminContext';
import { Avatar, IconButton } from './ui';
import { MODE_META, ROLE_LABEL } from './labels';
import { ADMIN } from './adminPath';

const NAV = [
  { to: ADMIN, label: 'Overview', icon: LayoutGrid, end: true },
  { to: `${ADMIN}/properties`, label: 'Properties', icon: Building2 },
  { to: `${ADMIN}/waitlist`, label: 'Waitlist', icon: ListChecks },
  { to: `${ADMIN}/users`, label: 'Users', icon: Users },
  { to: `${ADMIN}/analytics`, label: 'Analytics', icon: BarChart3 },
  { to: `${ADMIN}/activity`, label: 'Activity logs', icon: Activity },
  { to: `${ADMIN}/settings`, label: 'Settings', icon: Settings },
];

export function AdminLayout() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Admin · anieghar';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-[#fafafa] font-display text-ink">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] border-r border-black/[0.07] bg-white lg:flex">
        <Sidebar />
      </aside>

      {/* Phone / tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-black/[0.07] bg-white/95 px-4 backdrop-blur lg:hidden">
        <Brand />
        <IconButton label="Open menu" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </IconButton>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-black/25" onClick={() => setOpen(false)} />
          <aside className="admin-drawer-left absolute inset-y-0 left-0 flex w-[272px] max-w-[85%] bg-white shadow-2xl">
            <IconButton label="Close menu" className="absolute right-3 top-3" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </IconButton>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="lg:pl-[244px]">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <span className="flex items-center gap-2">
      <img src={logo} alt="" className="h-7 w-auto" />
      <span className="text-[17px] font-medium tracking-tight text-[#0046FF]">anieghar</span>
      <span className="rounded bg-ink px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-white">Admin</span>
    </span>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, role } = useAdmin();
  const { logout } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: settings } = useQuery({ queryKey: ['admin-settings'], queryFn: adminApi.settings, staleTime: 30_000 });
  const mode = settings ? MODE_META[settings.mode] : null;

  const signOut = async () => {
    await authApi.logout().catch(() => {});
    logout();
    qc.clear();
    navigate(`${ADMIN}/login`, { replace: true });
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <Brand />
        {mode && (
          <NavLink
            to={`${ADMIN}/settings`}
            onClick={onNavigate}
            className="mt-4 flex items-center gap-2 rounded-lg border border-black/[0.07] px-2.5 py-2 text-[12.5px] transition-colors hover:bg-black/[0.03]"
            title="Change in Settings"
          >
            <span className={cn('h-2 w-2 shrink-0 rounded-full', mode.dot)} />
            <span className="text-muted">Site:</span>
            <span className="font-medium">{mode.label}</span>
          </NavLink>
        )}
      </div>

      <nav aria-label="Admin" className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] transition-colors',
                isActive ? 'bg-ink font-medium text-white' : 'text-ink/70 hover:bg-black/[0.04] hover:text-ink'
              )
            }
          >
            <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-black/[0.07] p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={user.name || user.email} src={user.avatar} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{user.name || user.email}</p>
            <p className="truncate text-[12px] text-muted">{ROLE_LABEL[role]}</p>
          </div>
          <IconButton label="Log out" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
