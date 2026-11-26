import apiClient from '@/lib/apiClient';

export const waitlistApi = {
  join: async (email: string): Promise<{ alreadyJoined: boolean; count: number }> => {
    const res = await apiClient.post('/waitlist', { email });
    return res.data.data;
  },

  count: async (): Promise<number> => {
    const res = await apiClient.get('/waitlist/count');
    return res.data.data.count;
  },
};
