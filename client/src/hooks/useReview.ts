import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewApi } from '@/api/review';
import { pgKeys } from '@/hooks/usePG';
import { useUIStore } from '@/stores/uiStore';
import type { CreateReviewPayload } from '@/types';

export function usePGReviews(pgId: string, page = 1) {
  return useQuery({
    queryKey: ['reviews', pgId, page],
    queryFn: () => reviewApi.getPGReviews(pgId, page),
    enabled: Boolean(pgId),
  });
}

export function useAddOrUpdateReview(pgId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  return useMutation({
    mutationFn: (payload: CreateReviewPayload) => reviewApi.addOrUpdateReview(pgId, payload),
    onSuccess: () => {
      addToast({ title: 'Review submitted!', description: 'Thank you for your feedback.', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['reviews', pgId] });
      queryClient.invalidateQueries({ queryKey: pgKeys.detail(pgId) });
      queryClient.invalidateQueries({ queryKey: pgKeys.lists() });
    },
    onError: (err) => {
      addToast({
        title: 'Failed to submit review',
        description: (err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteReview(pgId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  return useMutation({
    mutationFn: (reviewId: string) => reviewApi.deleteReview(reviewId),
    onSuccess: () => {
      addToast({ title: 'Review deleted', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['reviews', pgId] });
      queryClient.invalidateQueries({ queryKey: pgKeys.detail(pgId) });
      queryClient.invalidateQueries({ queryKey: pgKeys.lists() });
    },
    onError: () => {
      addToast({ title: 'Failed to delete review', variant: 'destructive' });
    },
  });
}
