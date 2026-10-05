import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  text: React.ReactNode;
  /** A button or link */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-[28px] bg-surface px-6 py-16 text-center', className)}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white">{icon}</span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
