import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { platformApi } from '@/api/platform';
import Maintenance from '@/pages/Maintenance';
import { ADMIN, ADMIN_ENABLED } from '@/pages/admin/adminPath';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ToastContainer } from '@/components/ui/Toast';
import { OnboardingModal } from '@/components/auth/OnboardingModal';
import { useAuthStore } from '@/stores/authStore';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';

// Pages
import { AuthPage } from '@/pages/auth/AuthPage';
import { WaitlistPage } from '@/pages/waitlist/WaitlistPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { PGListPage } from '@/pages/pg/PGListPage';
import { PGDetailsPage } from '@/pages/pg/PGDetailsPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { MyListingsPage } from '@/pages/dashboard/MyListingsPage';
import { NewPGPage } from '@/pages/dashboard/NewPGPage';
import { InquiriesPage } from '@/pages/dashboard/InquiriesPage';
import { SavedListingsPage } from '@/pages/dashboard/SavedListingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

/** Listings used to live at /pg — keep old links (and their filters) working */
function LegacyListingsRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/', search }} replace />;
}

/**
 * Shows the onboarding modal when user is authenticated but hasn't completed onboarding.
 * `isOnboarded === false` is strict — undefined (legacy users) is treated as onboarded.
 */
function OnboardingGate() {
  const { user, isAuthenticated } = useAuthStore();
  const needsOnboarding = isAuthenticated && user && user.isOnboarded === false;
  if (!needsOnboarding) return null;
  return <OnboardingModal />;
}

// The admin panel is its own bundle, so visitors never download it
const AdminApp = lazy(() => import('@/pages/admin/AdminApp'));

/**
 * The admin panel is reachable in every site mode. Everything else follows the mode
 * the founder sets in Admin → Settings (no redeploy needed).
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Secret address from VITE_ADMIN_PATH; /admin is just an unknown page to visitors */}
          {ADMIN_ENABLED && (
            <Route
              path={`${ADMIN}/*`}
              element={
                <Suspense fallback={null}>
                  <AdminApp />
                </Suspense>
              }
            />
          )}
          <Route path="*" element={<Site />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function Site() {
  const { data, isPending } = useQuery({ queryKey: ['platform'], queryFn: platformApi.get, staleTime: 30_000, retry: 2 });
  if (isPending) return null;
  // If the server can't be reached, stay on the waitlist: never open the app by accident
  const mode = data?.mode ?? 'waitlist';

  if (mode === 'maintenance') return <Maintenance message={data?.maintenanceMessage} />;
  if (mode === 'waitlist') {
    return (
      <Routes>
        <Route path="/" element={<WaitlistPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }
  return <PublicSite />;
}

function PublicSite() {
  return (
    <GoogleMapsProvider>
        <Routes>
          {/* Front page for visitors who aren't signed in: join the waitlist or log in */}
          <Route path="/welcome" element={<WaitlistPage showLogin />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          {/* Phone OTP now lives on the login page */}
          <Route path="/phone-login" element={<Navigate to="/login" replace />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          {/* Everything else requires an account (any role) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              {/* The listings page is the home page */}
              <Route path="/" element={<PGListPage />} />
              <Route path="/pg/:id" element={<PGDetailsPage />} />

              {/* Requests: brokers see their inbox, students see what they sent */}
              <Route path="/dashboard/inquiries" element={<InquiriesPage />} />

              {/* Student-only */}
              <Route element={<ProtectedRoute role="student" />}>
                <Route path="/dashboard/saved" element={<SavedListingsPage />} />
              </Route>

              {/* Broker-only */}
              <Route element={<ProtectedRoute role="owner" />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/dashboard/listings" element={<MyListingsPage />} />
                <Route path="/dashboard/listings/new" element={<NewPGPage />} />
                <Route path="/dashboard/listings/:id/edit" element={<NewPGPage />} />
              </Route>
            </Route>
            <Route path="/pg" element={<LegacyListingsRedirect />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global onboarding gate — renders over any page */}
        <OnboardingGate />
    </GoogleMapsProvider>
  );
}

export default App;
