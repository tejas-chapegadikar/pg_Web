import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import type { LoginPayload, RegisterPayload, UpdateProfilePayload, User } from '@/types';

/** Where a user lands after signing in: students browse listings, brokers get their dashboard. */
export const homeFor = (role: User['role']) => (role === 'owner' ? '/dashboard' : '/');

/** Thrown when someone signs in as a student with a broker account, or vice versa. */
export class RoleMismatchError extends Error {
  constructor(public actualRole: User['role']) {
    super('role-mismatch');
  }
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  return useMutation({
    mutationFn: async ({ expectedRole, ...payload }: LoginPayload & { expectedRole?: User['role'] }) => {
      const data = await authApi.login(payload);
      if (expectedRole && data.data.user.role !== expectedRole) {
        // Don't leave a session open for an account the user didn't mean to sign into
        await authApi.logout(data.data.accessToken).catch(() => {});
        throw new RoleMismatchError(data.data.user.role);
      }
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.data.user, data.data.accessToken);
    },
  });
}

export function useRegister() {
  const { setAuth } = useAuthStore();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: (data) => {
      setAuth(data.data.user, data.data.accessToken);
    },
  });
}

export function usePhoneLogin() {
  const { setAuth } = useAuthStore();
  return useMutation({
    mutationFn: (idToken: string) => authApi.phoneLogin(idToken),
    onSuccess: (data) => {
      setAuth(data.data.user, data.data.accessToken);
    },
  });
}

export function useUpdateProfile() {
  const { setAuth, accessToken } = useAuthStore();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => authApi.updateProfile(payload),
    onSuccess: (data) => {
      if (accessToken) {
        setAuth(data.data.user, accessToken);
      }
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      logout();
      qc.clear();
    },
    onError: () => {
      logout();
      qc.clear();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authApi.resetPassword({ token, password }),
  });
}
