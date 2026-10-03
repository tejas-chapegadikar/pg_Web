import apiClient from '@/lib/apiClient';
import type { AuthResponse, LoginPayload, RegisterPayload, UpdateProfilePayload } from '@/types';

export const authApi = {
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/register', payload);
    return res.data;
  },

  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/login', payload);
    return res.data;
  },

  phoneLogin: async (idToken: string): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/phone', { idToken });
    return res.data;
  },

  updateProfile: async (payload: UpdateProfilePayload): Promise<{ status: string; data: { user: import('@/types').User } }> => {
    const res = await apiClient.patch('/auth/me', payload);
    return res.data;
  },

  // `token` is for ending a session that was never stored (e.g. a rejected login)
  logout: async (token?: string): Promise<void> => {
    await apiClient.post('/auth/logout', {}, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  },

  refresh: async (): Promise<{ data: { accessToken: string } }> => {
    const res = await apiClient.post('/auth/refresh');
    return res.data;
  },

  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  forgotPassword: async (email: string): Promise<{ status: string; message: string }> => {
    const res = await apiClient.post('/auth/forgot-password', { email });
    return res.data;
  },

  resetPassword: async ({ token, password }: { token: string; password: string }): Promise<{ status: string; message: string }> => {
    const res = await apiClient.post(`/auth/reset-password/${token}`, { password });
    return res.data;
  },
};
