import { Link, useLocation } from 'react-router-dom';
import {
  Search, Heart, MessageSquare, LayoutDashboard,
  PlusCircle, Building2, Menu, X, LogOut, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useLogout } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo-dark.png';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  role?: 'student' | 'owner' | 'any';
}

const navItems: NavItem[] = [
  { label: 'Explore', href: '/', icon: <Search className="h-4 w-4" />, role: 'any' },
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, role: 'any' },
  { label: 'My Listings', href: '/dashboard/listings', icon: <Building2 className="h-4 w-4" />, role: 'owner' },
  { label: 'Add Listing', href: '/dashboard/listings/new', icon: <PlusCircle className="h-4 w-4" />, role: 'owner' },
  { label: 'Inquiries', href: '/dashboard/inquiries', icon: <MessageSquare className="h-4 w-4" />, role: 'any' },
  { label: 'Saved', href: '/dashboard/saved', icon: <Heart className="h-4 w-4" />, role: 'student' },
];

export function Sidebar() {
  const { user } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const location = useLocation();
  const logout = useLogout();

  const filtered = navItems.filter(
    (item) => item.role === 'any' || item.role === user?.role
  );

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-30 flex h-full w-64 flex-col border-r border-slate-100 bg-white premium-shadow',
          'transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <Link to="/" className="flex items-center hover:opacity-90 transition-opacity duration-200 shrink-0">
            <img src={logo} className="h-[40px] w-auto object-contain" alt="Anei Ghar Logo" />
          </Link>
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-900 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {filtered.map((item) => {
              const active = location.pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                      active
                        ? 'bg-blue-50 text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    {item.icon}
                    {item.label}
                    {active && <ChevronRight className="ml-auto h-3 w-3 text-blue-500" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Footer */}
        {user && (
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center gap-3 rounded-xl p-2 bg-slate-50 border border-slate-100">
              <Avatar name={user.name} size="sm" />
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
                <p className="truncate text-xs text-slate-500 capitalize">{user.role}</p>
              </div>
              <button
                onClick={() => logout.mutate()}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

export function Topbar() {
  const { toggleSidebar } = useUIStore();
  return (
    <header className="flex h-16 items-center gap-4 border-b border-slate-100 bg-white/80 px-6 backdrop-blur-md">
      <button
        onClick={toggleSidebar}
        className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-800 transition-colors lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
    </header>
  );
}
