import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pgApi } from '@/api/pg';
import { compressImage } from '@/lib/compressImage';
import type { CreatePGPayload, PGFilters } from '@/types';

export const pgKeys = {
  all: ['pg'] as const,
  lists: () => [...pgKeys.all, 'list'] as const,
  list: (filters: PGFilters) => [...pgKeys.lists(), filters] as const,
  details: () => [...pgKeys.all, 'detail'] as const,
  detail: (id: string) => [...pgKeys.details(), id] as const,
  myListings: () => [...pgKeys.all, 'mine'] as const,
};

export function usePGListings(filters: PGFilters = {}) {
  return useQuery({
    queryKey: pgKeys.list(filters),
    queryFn: () => pgApi.getListings(filters),
  });
}

export function usePGListing(id: string) {
  return useQuery({
    queryKey: pgKeys.detail(id),
    queryFn: () => pgApi.getListing(id),
    enabled: !!id,
  });
}

export function useMyListings() {
  return useQuery({
    queryKey: pgKeys.myListings(),
    queryFn: () => pgApi.getMyListings(),
  });
}

export function useCreatePG() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePGPayload) => pgApi.createListing(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pgKeys.lists() });
      qc.invalidateQueries({ queryKey: pgKeys.myListings() });
    },
  });
}

export function useUpdatePG() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreatePGPayload> }) =>
      pgApi.updateListing({ id, payload }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: pgKeys.detail(id) });
      qc.invalidateQueries({ queryKey: pgKeys.lists() });
      qc.invalidateQueries({ queryKey: pgKeys.myListings() });
    },
  });
}

export function useDeletePG() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pgApi.deleteListing(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pgKeys.lists() });
      qc.invalidateQueries({ queryKey: pgKeys.myListings() });
    },
  });
}

export function useUploadImages() {
  const qc = useQueryClient();
  return useMutation({
    // One shrunk photo per request, so no single upload gets near Vercel's size limit
    mutationFn: async ({ id, files }: { id: string; files: File[] }) => {
      let result: Awaited<ReturnType<typeof pgApi.uploadImages>> | undefined;
      for (const file of files) result = await pgApi.uploadImages(id, [await compressImage(file)]);
      return result;
    },
    // Photos show on the listing page, the cards and "My listings"
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: pgKeys.detail(id) });
      qc.invalidateQueries({ queryKey: pgKeys.lists() });
      qc.invalidateQueries({ queryKey: pgKeys.myListings() });
    },
  });
}

export function useDeleteImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, publicId }: { id: string; publicId: string }) =>
      pgApi.deleteImage({ id, publicId }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: pgKeys.detail(id) });
      qc.invalidateQueries({ queryKey: pgKeys.lists() });
      qc.invalidateQueries({ queryKey: pgKeys.myListings() });
    },
  });
}
