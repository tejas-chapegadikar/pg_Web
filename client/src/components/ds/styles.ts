import { cn } from '@/lib/utils';

/** Shared class strings for the new design (monochrome, soft-gray surfaces). Also used to style Links as buttons. */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-60',
    size === 'md' ? 'h-12 px-5 text-sm compact:h-11' : 'h-10 px-4 text-[13px]',
    variant === 'primary' && 'bg-ink text-white shadow-[0_14px_28px_-14px_rgba(17,17,17,0.7)] hover:bg-black/85 active:scale-[0.99]',
    variant === 'secondary' && 'border border-black/[0.08] bg-white hover:bg-surface',
    variant === 'ghost' && 'hover:bg-surface',
    variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
    className
  );
}

export const inputClasses =
  'w-full rounded-2xl border border-transparent bg-surface text-sm outline-none transition-all duration-200 placeholder:text-muted/80 focus:border-black/10 focus:bg-white focus:ring-4 focus:ring-black/[0.04]';
