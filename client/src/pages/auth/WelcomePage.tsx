import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowRight, Building2, GraduationCap } from 'lucide-react';
import { homeFor } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { buttonClasses } from '@/components/ds/styles';
import logo from '@/assets/logo-mark.svg';

const HERO = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1800&q=80&auto=format&fit=crop';

/** The site's front door — students and brokers land here first, then continue to the sign-in page */
export function WelcomePage() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user) return <Navigate to={homeFor(user.role)} replace />;

  return (
    <div className="min-h-dvh bg-white font-display text-ink sm:bg-backdrop sm:p-6 short:p-4">
      <div className="relative mx-auto flex min-h-dvh w-full flex-col overflow-hidden bg-ink sm:min-h-[calc(100dvh-3rem)] sm:rounded-[36px] sm:shadow-[0_40px_90px_-30px_rgba(15,23,42,0.25)] short:min-h-[calc(100dvh-2rem)]">
        <img src={HERO} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />

        <header className="relative p-5 sm:p-8">
          <span className="inline-flex rounded-2xl bg-white/90 p-3 backdrop-blur-md">
            <img src={logo} alt="Anei Ghar" className="h-10 w-auto" />
          </span>
        </header>

        <main className="relative mt-auto w-full max-w-2xl animate-fade-in p-5 pb-8 text-white sm:p-10 sm:pb-12">
          <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[46px] short:text-[36px]">
            Your next home in Jorhat starts here
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75 sm:text-[15px]">
            Verified PGs and flats for students, and one simple place for brokers to list rooms and answer enquiries.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-[13px] backdrop-blur-md">
              <GraduationCap className="h-4 w-4" /> Students: find a room
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-[13px] backdrop-blur-md">
              <Building2 className="h-4 w-4" /> Brokers: list your PG
            </span>
          </div>

          {/* Keep the page they were trying to open (e.g. a shared PG link) so login can send them back to it */}
          <Link
            to="/login"
            state={location.state}
            id="get-started-btn"
            className={buttonClasses(
              'secondary',
              'md',
              'mt-8 h-12 w-full border-transparent px-7 text-[15px] font-semibold text-ink sm:w-auto'
            )}
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </main>
      </div>
    </div>
  );
}
