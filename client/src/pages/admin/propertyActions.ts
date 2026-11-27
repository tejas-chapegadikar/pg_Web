import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, errorText } from '@/api/admin';
import { useUIStore } from '@/stores/uiStore';

const DONE: Record<string, string> = {
  approve: 'Listing approved',
  reject: 'Listing rejected',
  activate: 'Listing is live again',
  deactivate: 'Listing hidden from students',
  verify: 'Marked as verified',
  unverify: 'Verification removed',
};

/** Admin actions on a listing, shared by the list and the edit page */
export function usePropertyActions() {
  const qc = useQueryClient();
  const { addToast } = useUIStore();
  const done = (title: string) => {
    qc.invalidateQueries({ queryKey: ['admin-properties'] });
    qc.invalidateQueries({ queryKey: ['admin-property'] });
    qc.invalidateQueries({ queryKey: ['admin-overview'] });
    addToast({ title, variant: 'success' });
  };
  const fail = (err: unknown) => addToast({ title: 'That didn’t work', description: errorText(err), variant: 'destructive' });

  const action = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: string; reason?: string }) => adminApi.propertyAction(id, action, reason),
    onSuccess: (_, v) => done(DONE[v.action] ?? 'Saved'),
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteProperty(id),
    onSuccess: () => done('Listing deleted'),
    onError: fail,
  });
  return { action, remove };
}
