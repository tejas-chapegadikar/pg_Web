import type { AdminListing, AdminRole, PlatformMode, WaitlistStatus } from '@/api/admin';
import type { Tone } from './ui';

export const ROLE_LABEL: Record<AdminRole, string> = { founder: 'Founder', cofounder: 'Co-founder' };

export const MODE_META: Record<PlatformMode, { label: string; dot: string; text: string }> = {
  waitlist: { label: 'Waitlist', dot: 'bg-amber-500', text: 'Visitors only see the waitlist page.' },
  public: { label: 'Public', dot: 'bg-emerald-500', text: 'Everyone can use the full app.' },
  maintenance: { label: 'Maintenance', dot: 'bg-red-500', text: 'Visitors see a “back soon” page.' },
};

export const WAITLIST_STATUS: { value: WaitlistStatus; label: string; tone: Tone }[] = [
  { value: 'new', label: 'New', tone: 'blue' },
  { value: 'contacted', label: 'Contacted', tone: 'neutral' },
  { value: 'interested', label: 'Interested', tone: 'amber' },
  { value: 'converted', label: 'Converted', tone: 'green' },
];
export const waitlistStatusMeta = (s?: string) => WAITLIST_STATUS.find((x) => x.value === s) ?? WAITLIST_STATUS[0];

/** One badge for where a listing stands, in order of what matters most */
export function listingState(pg: Pick<AdminListing, 'status' | 'isActive'>): { label: string; tone: Tone } {
  if (pg.status === 'pending') return { label: 'Pending review', tone: 'amber' };
  if (pg.status === 'rejected') return { label: 'Rejected', tone: 'red' };
  if (pg.isActive === false) return { label: 'Inactive', tone: 'neutral' };
  return { label: 'Live', tone: 'green' };
}

export const ACTION_LABEL: Record<string, string> = {
  'property.create': 'Added a listing',
  'property.update': 'Edited a listing',
  'property.delete': 'Deleted a listing',
  'property.approve': 'Approved a listing',
  'property.reject': 'Rejected a listing',
  'property.activate': 'Reactivated a listing',
  'property.deactivate': 'Deactivated a listing',
  'property.verify': 'Verified a listing',
  'property.unverify': 'Removed verification',
  'property.photos_add': 'Added photos',
  'property.photo_delete': 'Deleted a photo',
  'property.photos_reorder': 'Reordered photos',
  'user.suspend': 'Suspended a user',
  'user.reactivate': 'Reactivated a user',
  'user.role': 'Changed account type',
  'admin.permissions': 'Changed admin access',
  'waitlist.status': 'Updated waitlist status',
  'waitlist.update': 'Edited a registration',
  'waitlist.note': 'Added a waitlist note',
  'waitlist.export': 'Exported the waitlist',
  'settings.mode': 'Changed the site mode',
  'settings.update': 'Changed settings',
};
