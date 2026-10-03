import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inquiryApi, savesApi, dashboardApi } from '@/api/inquiry';
import type { CreateInquiryPayload } from '@/types';

// ── Inquiry hooks ─────────────────────────────────────────────────────────────
export function useCreateInquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInquiryPayload) => inquiryApi.createInquiry(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inquiries'] });
    },
  });
}

export function useOwnerInquiries(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: ['inquiries', 'owner', params],
    queryFn: () => inquiryApi.getOwnerInquiries(params),
  });
}

export function useStudentInquiries(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['inquiries', 'student'],
    queryFn: () => inquiryApi.getStudentInquiries(),
    ...options,
  });
}

export function useUpdateInquiryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      inquiryApi.updateStatus({ id, status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inquiries'] });
    },
  });
}

// ── Saves hooks ───────────────────────────────────────────────────────────────
export function useToggleSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pgId: string) => savesApi.toggleSave(pgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saves'] });
    },
  });
}

export function useSavedListings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['saves'],
    queryFn: () => savesApi.getSavedListings(),
    ...options,
  });
}

// ── Dashboard hooks ───────────────────────────────────────────────────────────
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getStats(),
  });
}
