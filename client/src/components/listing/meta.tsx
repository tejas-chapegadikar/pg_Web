import {
  AirVent,
  Car,
  Cctv,
  Droplets,
  Dumbbell,
  ShieldCheck,
  Sparkles,
  Trees,
  Tv,
  Utensils,
  WashingMachine,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { PGListing, PropertyType } from '@/types';

/** Mirrors the amenity enum in server/models/PGListing.js */
export const AMENITIES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { value: 'ac', label: 'AC', icon: AirVent },
  { value: 'meals', label: 'Meals', icon: Utensils },
  { value: 'laundry', label: 'Laundry', icon: WashingMachine },
  { value: 'housekeeping', label: 'Housekeeping', icon: Sparkles },
  { value: 'power-backup', label: 'Power backup', icon: Zap },
  { value: 'water_purifier', label: 'Water purifier', icon: Droplets },
  { value: 'security', label: 'Security', icon: ShieldCheck },
  { value: 'cctv', label: 'CCTV', icon: Cctv },
  { value: 'parking', label: 'Parking', icon: Car },
  { value: 'gym', label: 'Gym', icon: Dumbbell },
  { value: 'tv', label: 'TV', icon: Tv },
  { value: 'garden', label: 'Garden', icon: Trees },
];

export const amenityMeta = (value: string) =>
  AMENITIES.find((a) => a.value === value) ?? { value, label: value, icon: Sparkles };

export const ROOM_TYPES = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'triple', label: 'Triple' },
  { value: 'dormitory', label: 'Dormitory' },
] as const;

export const BHK_OPTIONS = [
  { value: '1', label: '1 BHK' },
  { value: '2', label: '2 BHK' },
  { value: '3+', label: '3+ BHK' },
] as const;

export const GENDERS = [
  { value: 'female', label: 'Girls only' },
  { value: 'male', label: 'Boys only' },
  { value: 'any', label: 'Co-ed' },
] as const;

/** Colleges with a "PGs within 3 km" shortcut (moved from the old home page) */
export const COLLEGES = [
  { id: 'ku', name: 'Kaziranga University', short: 'Kaziranga Univ.', lat: 26.7499, lng: 94.2108 },
  { id: 'jbu', name: 'Jagannath Barooah University', short: 'JB University', lat: 26.7472, lng: 94.2031 },
  { id: 'jmch', name: 'Jorhat Medical College', short: 'JMCH', lat: 26.758, lng: 94.2097 },
  { id: 'aau', name: 'Assam Agricultural University', short: 'AAU Jorhat', lat: 26.7516, lng: 94.2136 },
] as const;

export const NEARBY_RADIUS_KM = 3;

export const typeOf = (pg: PGListing): PropertyType => pg.propertyType ?? 'pg';

export const typeLabel = (type: PropertyType) => (type === 'flat' ? 'Flat' : 'PG');

/** "Double sharing" for PGs, "2 BHK" for flats. `short` fits listing cards ("2 sharing"). */
export function roomLabel(pg: PGListing, short = false) {
  if (typeOf(pg) === 'flat') return pg.bhk ? `${pg.bhk} BHK` : 'Flat';
  switch (pg.roomType) {
    case 'single':
      return short ? 'Single' : 'Single room';
    case 'double':
      return short ? '2 sharing' : 'Double sharing';
    case 'triple':
      return short ? '3 sharing' : 'Triple sharing';
    case 'dormitory':
      return short ? 'Dorm' : 'Dormitory';
    default:
      return 'PG';
  }
}

export function genderLabel(pg: PGListing, short = false) {
  if (pg.genderPreference === 'female') return short ? 'Girls' : 'Girls only';
  if (pg.genderPreference === 'male') return short ? 'Boys' : 'Boys only';
  return typeOf(pg) === 'flat' ? 'Anyone' : 'Co-ed';
}

export const formatRent = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
