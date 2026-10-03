import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

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
        title: 'Access Denied',
        description: `This page is restricted to ${role}s only.`,
        variant: 'destructive',
      });
    }
  }, [isAuthenticated, isRoleMismatch, role, addToast]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isRoleMismatch) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
