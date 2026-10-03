import type { PropertyType } from '@/types';

export type TypeFilter = 'all' | PropertyType;

export interface ListingFilterValues {
  type: TypeFilter;
  gender?: 'male' | 'female' | 'any';
  room?: string;
  bhk?: string;
  /** Undefined = no lower bound */
  minRent?: number;
  /** Undefined = no upper bound */
  maxRent?: number;
  amenities: string[];
  includeFull: boolean;
}

export const PRICE_MIN = 1000;
export const PRICE_MAX = 30000;
export const PRICE_STEP = 500;

export const EMPTY_FILTERS: ListingFilterValues = { type: 'all', amenities: [], includeFull: false };

/** Filters that live in the sheet (type has its own tabs on the page, so it isn't counted) */
export function countActiveFilters(f: ListingFilterValues) {
  return [f.gender, f.room, f.bhk, f.minRent ?? f.maxRent, f.amenities.length || undefined, f.includeFull || undefined].filter(
    (v) => v !== undefined
  ).length;
}
