import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { homeFor } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  role?: 'student' | 'owner';
}

export function ProtectedRoute({ role }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const { addToast } = useUIStore();
  const location = useLocation();

  const isRoleMismatch = role && user?.role !== role;

  useEffect(() => {
    if (isAuthenticated && isRoleMismatch) {
      addToast({
        title: role === 'owner' ? 'That page is for brokers' : 'That page is for students',
        description: 'We’ve taken you to your home page instead.',
        variant: 'destructive',
      });
    }
  }, [isAuthenticated, isRoleMismatch, role, addToast]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isRoleMismatch && user) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return <Outlet />;
}
