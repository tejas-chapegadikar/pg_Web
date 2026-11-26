import apiClient from '@/lib/apiClient';

export type WaitlistRole = 'student' | 'owner';
export interface WaitlistCounts {
  count: number;
  students: number;
  owners: number;
}

export const waitlistApi = {
  join: async ({ email, role }: { email: string; role: WaitlistRole }): Promise<WaitlistCounts & { alreadyJoined: boolean }> => {
    const res = await apiClient.post('/waitlist', { email, role });
    return res.data.data;
  },

  counts: async (): Promise<WaitlistCounts> => {
    const res = await apiClient.get('/waitlist/count');
    return res.data.data;
  },
};
