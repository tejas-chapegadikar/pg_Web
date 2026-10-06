import { Link, NavLink, Outlet } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut, Plus } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { cn, getInitials } from '@/lib/utils';
import { buttonClasses } from '@/components/ds/styles';
import { ChatbotWidget } from '@/components/chatbot/ChatbotWidget';
import logo from '@/assets/logo-dark.png';
import logoMark from '@/assets/logo-mark.svg';

// Full screen width on every device, with side margins that grow on bigger screens
const GUTTER = 'px-4 sm:px-6 lg:px-10 2xl:px-14';

/** Shell for the signed-in site (listings + listing details), in the new design */
export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-display text-ink">
      <SiteHeader />
      <main className={cn('w-full flex-1 pb-20 pt-6', GUTTER)}>
        <Outlet />
      </main>
      <footer className="border-t border-black/[0.06]">
        <div className={cn('flex flex-wrap items-center justify-between gap-3 py-6 text-[13px] text-muted', GUTTER)}>
          <img src={logo} alt="Anei Ghar" className="h-7 w-auto opacity-80" />
          {/* Room on the right for the floating chat button */}
          <p className="mr-16">© {new Date().getFullYear()} Anei Ghar · PGs and flats for students</p>
        </div>
      </footer>
      <ChatbotWidget />
    </div>
  );
}

function useNavItems() {
  const { user } = useAuthStore();
  return user?.role === 'owner'
    ? [
        { to: '/', label: 'Explore', end: true },
        { to: '/dashboard', label: 'Dashboard', end: true },
        // Also highlighted while adding or editing a listing
        { to: '/dashboard/listings', label: 'My listings', end: false },
        { to: '/dashboard/inquiries', label: 'Requests', end: true },
      ]
    : [
        { to: '/', label: 'Explore', end: true },
        { to: '/dashboard/saved', label: 'Saved', end: true },
        { to: '/dashboard/inquiries', label: 'My requests', end: true },
      ];
}

function SiteHeader() {
  const nav = useNavItems();
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 backdrop-blur-md">
      <div className={cn('flex h-16 items-center gap-8', GUTTER)}>
        <Link to="/" className="shrink-0" aria-label="Anei Ghar home">
          <img src={logoMark} alt="Anei Ghar" className="h-10 w-auto" />
        </Link>
        {/* Tablets and phones get these links in the profile menu instead */}
        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-surface text-ink' : 'text-muted hover:text-ink'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {user?.role === 'owner' && (
            <Link to="/dashboard/listings/new" id="header-add-listing" className={buttonClasses('primary', 'sm', 'hidden sm:inline-flex')}>
              <Plus className="h-4 w-4" />
              Add listing
            </Link>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function UserMenu() {
  const { user } = useAuthStore();
  const logout = useLogout();
  const nav = useNavItems();
  if (!user) return null;

  const roleLabel = user.role === 'owner' ? 'Broker / Agent' : 'Student';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        id="user-menu"
        className="flex items-center gap-2.5 rounded-2xl py-1.5 pl-1.5 pr-2.5 outline-none transition-colors hover:bg-surface data-[state=open]:bg-surface"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-white">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            getInitials(user.name || '?')
          )}
        </span>
        <span className="hidden max-w-[180px] text-left sm:block">
          <span className="block truncate text-sm font-medium leading-tight">{user.name}</span>
          <span className="block truncate text-xs leading-tight text-muted">{roleLabel}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-60 rounded-2xl border border-black/[0.06] bg-white p-1.5 font-display text-ink shadow-[0_20px_50px_-20px_rgba(17,17,17,0.35)] animate-fade-in"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email ?? user.phone}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-black/[0.06]" />
          {/* On phones and tablets the header nav is hidden, so it lives here */}
          {nav.map((item) => (
            <DropdownMenu.Item key={item.to} asChild>
              <Link
                to={item.to}
                className="block rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-surface lg:hidden"
              >
                {item.label}
              </Link>
            </DropdownMenu.Item>
          ))}
          {user.role === 'owner' && (
            <DropdownMenu.Item asChild>
              <Link
                to="/dashboard/listings/new"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium outline-none data-[highlighted]:bg-surface sm:hidden"
              >
                <Plus className="h-4 w-4" />
                Add listing
              </Link>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-black/[0.06] lg:hidden" />
          <DropdownMenu.Item
            id="logout-btn"
            // Clearing the session makes ProtectedRoute send them to /login
            onSelect={() => logout.mutate()}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-red-600 outline-none data-[highlighted]:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
