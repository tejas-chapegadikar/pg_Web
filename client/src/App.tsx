import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ToastContainer } from '@/components/ui/Toast';
import { OnboardingModal } from '@/components/auth/OnboardingModal';
import { useAuthStore } from '@/stores/authStore';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';

// Pages
import { AuthPage } from '@/pages/auth/AuthPage';
import { PhoneLoginPage } from '@/pages/auth/PhoneLoginPage';
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

function App() {
  return (
    <GoogleMapsProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Auth — the only pages open without signing in; login is the site's front door */}
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/phone-login" element={<PhoneLoginPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          {/* Everything else requires an account (any role) */}
          <Route element={<ProtectedRoute />}>
            {/* The listings page is the home page */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<PGListPage />} />
              <Route path="/pg/:id" element={<PGDetailsPage />} />
            </Route>
            <Route path="/pg" element={<LegacyListingsRedirect />} />

            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/inquiries" element={<InquiriesPage />} />

              {/* Student-only */}
              <Route element={<ProtectedRoute role="student" />}>
                <Route path="/dashboard/saved" element={<SavedListingsPage />} />
              </Route>

              {/* Owner-only */}
              <Route element={<ProtectedRoute role="owner" />}>
                <Route path="/dashboard/listings" element={<MyListingsPage />} />
                <Route path="/dashboard/listings/new" element={<NewPGPage />} />
                <Route path="/dashboard/listings/:id/edit" element={<NewPGPage />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global onboarding gate — renders over any page */}
        <OnboardingGate />
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
    </GoogleMapsProvider>
  );
}

export default App;
