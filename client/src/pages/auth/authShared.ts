import { Briefcase, GraduationCap } from 'lucide-react';
import type { User } from '@/types';

export type Role = User['role'];
export type Mode = 'login' | 'register';

export const ROLES = [
  { value: 'student', title: 'Student', description: 'Browse PGs & send enquiries', icon: GraduationCap },
  { value: 'owner', title: 'Broker / Agent', description: 'List PGs & manage enquiries', icon: Briefcase },
] as const;

export const ROLE_LABEL: Record<Role, string> = { student: 'Student', owner: 'Broker / Agent' };

type ApiError = { response?: { status?: number; data?: { message?: string } } };

export const apiMessage = (err: unknown, fallback: string) => (err as ApiError)?.response?.data?.message || fallback;
export const apiStatus = (err: unknown) => (err as ApiError)?.response?.status;

/** Follows "Google sign-in" when Firebase isn't configured yet */
export const FIREBASE_MISSING = import.meta.env.DEV
  ? 'needs the Firebase keys in client/.env (see client/.env.example).'
  : 'isn’t available right now. Please use your email instead.';
