import apiClient from '@/lib/apiClient';

export type WaitlistRole = 'student' | 'owner';

export const waitlistApi = {
  join: async ({ email, role }: { email: string; role: WaitlistRole }): Promise<{ alreadyJoined: boolean; count: number }> => {
    const res = await apiClient.post('/waitlist', { email, role });
    return res.data.data;
  },

  count: async (): Promise<number> => {
    const res = await apiClient.get('/waitlist/count');
    return res.data.data.count;
  },
};
