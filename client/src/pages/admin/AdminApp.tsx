import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import { useAuthStore } from '@/stores/authStore';
import { AdminContext } from './adminContext';
import { AdminLogin } from './AdminLogin';
import { AdminLayout } from './AdminLayout';
import { OverviewPage } from './OverviewPage';
import { PropertiesPage } from './PropertiesPage';
import { PropertyFormPage } from './PropertyFormPage';
import { UsersPage } from './UsersPage';
import { AnalyticsPage } from './AnalyticsPage';
import { LogsPage } from './LogsPage';
import { SettingsPage } from './SettingsPage';
import { AccessDenied } from './AccessDenied';
import { ADMIN } from './adminPath';

/**
 * /admin/*. The browser never decides who is an admin: every page waits for the
 * server's answer to /api/admin/me, and every admin API checks again on its own.
 */
export default function AdminApp() {
  // Keep the panel out of search engines
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route path="*" element={<Gate />} />
    </Routes>
  );
}

function Gate() {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const me = useQuery({
    queryKey: ['admin-me'],
    queryFn: adminApi.me,
    enabled: isAuthenticated,
    retry: false,
    staleTime: 60_000,
  });

  if (!isAuthenticated) return <Navigate to={`${ADMIN}/login`} replace state={{ from: location.pathname }} />;
  if (me.isPending) return <FullScreenLoader />;
  if (me.isError) {
    const status = (me.error as { response?: { status?: number } }).response?.status;
    if (status === 401) return <Navigate to={`${ADMIN}/login`} replace />;
    return <AccessDenied status={status} />;
  }

  return (
    <AdminContext.Provider value={{ user: me.data.user, role: me.data.adminRole }}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="properties" element={<PropertiesPage />} />
          <Route path="properties/new" element={<PropertyFormPage />} />
          <Route path="properties/:id" element={<PropertyFormPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="activity" element={<LogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to={`${ADMIN}`} replace />} />
        </Route>
      </Routes>
    </AdminContext.Provider>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-white" aria-busy="true" aria-label="Loading the admin panel">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/10 border-t-ink" />
    </div>
  );
}
