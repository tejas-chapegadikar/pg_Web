import { createContext, useContext } from 'react';
import type { AdminRole } from '@/api/admin';
import type { User } from '@/types';

export interface AdminSession {
  user: User;
  role: AdminRole;
}
export const AdminContext = createContext<AdminSession | null>(null);

/** The signed-in admin. Only used inside the admin routes, after the server confirmed access. */
export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin outside the admin panel');
  return value;
}
