import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Request interceptor — attach access token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// A page often fires several requests at once. They must share one refresh: each refresh
// replaces the cookie's token, so a second one sent alongside it would be rejected.
let refreshing: Promise<string> | null = null;

const refreshAccessToken = () => {
  refreshing ??= axios
    .post('/api/auth/refresh', {}, { withCredentials: true })
    .then((res) => {
      const { accessToken } = res.data.data;
      useAuthStore.getState().setToken(accessToken);
      return accessToken as string;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

// Response interceptor — handle 401, try token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url: string | undefined = originalRequest?.url;
    const isAuthRoute = url?.startsWith('/auth/') && !url.startsWith('/auth/me');

    // Never intercept login, refresh or logout — let them fail naturally
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;

      let accessToken: string;
      try {
        accessToken = await refreshAccessToken();
      } catch (refreshError) {
        // Only a rejected session ends it; a network blip or busy server shouldn't sign anyone out
        if ((refreshError as { response?: { status?: number } }).response?.status === 401) {
          useAuthStore.getState().logout();
          window.location.href = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
        }
        return Promise.reject(error);
      }

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
