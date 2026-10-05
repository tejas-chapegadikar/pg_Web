import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import type { AuthResponse, LoginPayload, RegisterPayload, UpdateProfilePayload, User } from '@/types';

/** Where a user lands after signing in: students browse listings, brokers get their dashboard. */
export const homeFor = (role: User['role']) => (role === 'owner' ? '/dashboard' : '/');

/** Thrown when someone signs in as a student with a broker account, or vice versa. */
export class RoleMismatchError extends Error {
  constructor(public actualRole: User['role']) {
    super('role-mismatch');
  }
}

async function enforceRole(data: AuthResponse, expectedRole?: User['role']) {
  if (expectedRole && data.data.user.role !== expectedRole) {
    // Don't leave a session open for an account the user didn't mean to sign into
    await authApi.logout(data.data.accessToken).catch(() => {});
    throw new RoleMismatchError(data.data.user.role);
  }
  return data;
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  return useMutation({
    mutationFn: async ({ expectedRole, ...payload }: LoginPayload & { expectedRole?: User['role'] }) =>
      enforceRole(await authApi.login(payload), expectedRole),
    onSuccess: (data) => {
      setAuth(data.data.user, data.data.accessToken);
    },
  });
}

/**
 * Finish a Google sign-in or sign-up: checks the role picked on the form,
 * then stores the session.
 */
export function useAuthenticate() {
  const { setAuth } = useAuthStore();
  return useMutation({
    mutationFn: async ({ run, expectedRole }: { run: () => Promise<AuthResponse>; expectedRole?: User['role'] }) =>
      enforceRole(await run(), expectedRole),
    onSuccess: (data) => {
      setAuth(data.data.user, data.data.accessToken);
    },
  });
}

/** Sign-up step 1: email a code to confirm the address */
export function useSendSignupCode() {
  return useMutation({
    mutationFn: (email: string) => authApi.sendSignupCode(email),
  });
}

/** Sign-up step 2: create the account with the emailed code */
export function useRegister() {
  const { setAuth } = useAuthStore();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
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
