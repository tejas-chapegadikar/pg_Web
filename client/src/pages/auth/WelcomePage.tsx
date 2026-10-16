import { useRef } from 'react';
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
  const photoRef = useRef<HTMLDivElement>(null);

  if (isAuthenticated && user) return <Navigate to={homeFor(user.role)} replace />;

  // The photo drifts gently against the mouse, for a sense of depth (mouse/trackpad only)
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !photoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    photoRef.current.style.transform = `translate3d(${x * -18}px, ${y * -18}px, 0)`;
  };

  return (
    <div className="min-h-dvh bg-white font-display text-ink sm:bg-backdrop sm:p-6 short:p-4">
      <div
        onPointerMove={onPointerMove}
        className="relative mx-auto flex min-h-dvh w-full flex-col overflow-hidden bg-ink sm:min-h-[calc(100dvh-3rem)] sm:rounded-[36px] sm:shadow-[0_40px_90px_-30px_rgba(15,23,42,0.25)] short:min-h-[calc(100dvh-2rem)]"
      >
        <div ref={photoRef} className="absolute -inset-6 transition-transform duration-700 ease-out">
          <img src={HERO} alt="" className="animate-kenburns h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />

        <header className="relative p-5 sm:p-8">
          <span
            className="inline-flex rounded-2xl bg-white/90 p-3 backdrop-blur-md"
            style={{ viewTransitionName: 'brand-logo' }}
          >
            <img src={logo} alt="Anei Ghar" className="h-10 w-auto" />
          </span>
        </header>

        <main className="stagger relative mt-auto w-full max-w-2xl p-5 pb-8 text-white sm:p-10 sm:pb-12">
          <h1
            style={{ '--i': 0 } as React.CSSProperties}
            className="text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[46px] short:text-[36px]"
          >
            A room that feels like home, wherever college takes you
          </h1>
          <p style={{ '--i': 1 } as React.CSSProperties} className="mt-3 max-w-md text-sm leading-relaxed text-white/75 sm:text-[15px]">
            Verified PGs and flats near campuses across India, and one simple place for owners and brokers to fill their rooms.
          </p>

          <div style={{ '--i': 2 } as React.CSSProperties} className="mt-6 flex flex-wrap gap-2.5">
            {[
              { icon: GraduationCap, label: 'Students: find a room' },
              { icon: Building2, label: 'Brokers: list your PG' },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-[13px] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/25"
              >
                <Icon className="h-4 w-4" /> {label}
              </span>
            ))}
          </div>

          {/* Keep the page they were trying to open (e.g. a shared PG link) so login can send them back to it */}
          <div style={{ '--i': 3 } as React.CSSProperties}>
            <Link
              to="/login"
              state={location.state}
              viewTransition
              id="get-started-btn"
              className={buttonClasses(
                'secondary',
                'md',
                'group mt-8 h-12 w-full border-transparent px-7 text-[15px] font-semibold text-ink hover:scale-[1.03] hover:bg-white hover:shadow-[0_18px_40px_-12px_rgba(255,255,255,0.45)] sm:w-auto'
              )}
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
