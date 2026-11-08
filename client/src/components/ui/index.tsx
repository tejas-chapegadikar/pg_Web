import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-blue-50 text-blue-700 border-blue-100',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    destructive: 'bg-red-50 text-red-700 border-red-100',
    outline: 'bg-transparent text-slate-650 border-slate-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

// Skeleton loader
type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton rounded-xl', className)}
      {...props}
    />
  );
}

// Avatar
interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base' };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover ring-2 ring-slate-100 shadow-sm', sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-blue-650 font-bold text-white ring-2 ring-slate-100 shadow-sm',
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  );
}

// Spinner
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600',
        className
      )}
    />
  );
}

// Divider
export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-slate-150', className)} />;
}
