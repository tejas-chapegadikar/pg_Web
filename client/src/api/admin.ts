import apiClient from '@/lib/apiClient';
import type { PGListing, User } from '@/types';

export type AdminRole = 'founder' | 'cofounder';
export type PlatformMode = 'waitlist' | 'public' | 'maintenance';

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DayCount {
  date: string;
  count: number;
}
export interface LabelCount {
  label: string;
  count: number;
}

export interface AdminListing extends Omit<PGListing, 'owner' | 'location'> {
  owner?: { _id: string; name?: string; email?: string; role?: string; phone?: string };
  location: PGListing['location'] & { locality?: string };
  status?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  isActive?: boolean;
  isVerified?: boolean;
  isAvailable?: boolean;
  furnishing?: 'furnished' | 'semi-furnished' | 'unfurnished';
  contact?: { name?: string; phone?: string };
  rules?: string[];
}

export interface AdminUser extends Omit<User, 'role'> {
  role: 'student' | 'owner';
  isSuspended?: boolean;
  suspendedReason?: string;
  adminRole?: AdminRole | null;
  adminFromConfig?: boolean;
  lastLoginAt?: string;
  listingCount?: number;
  updatedAt?: string;
}

export interface ActivityEntry {
  _id: string;
  admin: string;
  adminName?: string;
  adminEmail?: string;
  adminRole?: AdminRole;
  action: string;
  targetType?: 'property' | 'user' | 'settings';
  targetId?: string;
  summary?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformSettings {
  mode: PlatformMode;
  cities: string[];
  propertyTypes: { pg: boolean; flat: boolean };
  announcement: string;
  waitlistMessage: string;
  maintenanceMessage: string;
  requireApproval: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export interface Overview {
  mode: PlatformMode;
  stats: {
    totalListings: number;
    activePG: number;
    activeFlat: number;
    pending: number;
    waitlistTotal: number;
    waitlistNewWeek: number;
    students: number;
    brokers: number;
  };
  recentProperties: AdminListing[];
  recentUsers: AdminUser[];
  charts: { waitlistTrend: DayCount[]; listingTrend: DayCount[]; typeSplit: LabelCount[]; listingsByCity: LabelCount[] };
}

export interface Analytics {
  days: number;
  totals: { waitlist: number; listings: number; users: number; inquiries: number };
  waitlistTrend: DayCount[];
  listingTrend: DayCount[];
  userTrend: DayCount[];
  waitlistByRole: LabelCount[];
  listingsByCity: LabelCount[];
  listingsByGender: LabelCount[];
  usersByRole: LabelCount[];
  rent: { type: 'pg' | 'flat'; avg: number; min: number; max: number; count: number }[];
  topViewed: { _id: string; title: string; propertyType?: string; analytics: { views: number }; location: { city: string } }[];
}

type Query = Record<string, string | number | undefined>;
const clean = (q: Query) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ''));
const data = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const adminApi = {
  me: () => data<{ user: User; adminRole: AdminRole }>(apiClient.get('/admin/me')),
  overview: () => data<Overview>(apiClient.get('/admin/overview')),
  analytics: (days: number) => data<Analytics>(apiClient.get('/admin/analytics', { params: { days } })),

  properties: (q: Query) =>
    data<{ items: AdminListing[]; pagination: Pagination; cities: string[] }>(apiClient.get('/admin/properties', { params: clean(q) })),
  property: (id: string) => data<{ pg: AdminListing }>(apiClient.get(`/admin/properties/${id}`)).then((d) => d.pg),
  createProperty: (body: Record<string, unknown>) =>
    data<{ pg: AdminListing }>(apiClient.post('/admin/properties', body)).then((d) => d.pg),
  updateProperty: (id: string, body: Record<string, unknown>) =>
    data<{ pg: AdminListing }>(apiClient.patch(`/admin/properties/${id}`, body)).then((d) => d.pg),
  propertyAction: (id: string, action: string, reason?: string) =>
    data<{ pg: AdminListing }>(apiClient.post(`/admin/properties/${id}/status`, { action, reason })).then((d) => d.pg),
  deleteProperty: (id: string) => apiClient.delete(`/admin/properties/${id}`),
  uploadPhotos: (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    return data<{ pg: AdminListing }>(apiClient.post(`/admin/properties/${id}/images`, form)).then((d) => d.pg);
  },
  deletePhoto: (id: string, publicId: string) =>
    data<{ pg: AdminListing }>(apiClient.delete(`/admin/properties/${id}/images/${encodeURIComponent(publicId)}`)).then((d) => d.pg),
  reorderPhotos: (id: string, order: string[]) =>
    data<{ pg: AdminListing }>(apiClient.put(`/admin/properties/${id}/images/order`, { order })).then((d) => d.pg),

  users: (q: Query) => data<{ items: AdminUser[]; pagination: Pagination }>(apiClient.get('/admin/users', { params: clean(q) })),
  user: (id: string) =>
    data<{
      user: AdminUser;
      listings: AdminListing[];
      activity: { inquiriesSent: number; inquiriesReceived: number; saves: number };
      logs: ActivityEntry[];
    }>(apiClient.get(`/admin/users/${id}`)),
  updateUser: (id: string, body: { role?: string; isSuspended?: boolean; reason?: string; adminRole?: AdminRole | null }) =>
    data<{ user: AdminUser }>(apiClient.patch(`/admin/users/${id}`, body)).then((d) => d.user),

  settings: () => data<{ settings: PlatformSettings }>(apiClient.get('/admin/settings')).then((d) => d.settings),
  updateSettings: (body: Partial<PlatformSettings>) =>
    data<{ settings: PlatformSettings }>(apiClient.patch('/admin/settings', body)).then((d) => d.settings),

  logs: (q: Query) =>
    data<{ items: ActivityEntry[]; pagination: Pagination; admins: { _id: string; name?: string; email?: string }[] }>(
      apiClient.get('/admin/logs', { params: clean(q) })
    ),
};

/** Short readable message from an API error */
export const errorText = (err: unknown, fallback = 'Something went wrong. Please try again.') =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
