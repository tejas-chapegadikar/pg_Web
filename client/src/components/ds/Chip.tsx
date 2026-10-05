import { cn } from '@/lib/utils';

/** Pill toggle — black when selected (type tabs, filter options, form choices) */
export function Chip({
  selected,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[13px] font-medium transition-colors',
        selected ? 'border-ink bg-ink text-white' : 'border-black/[0.08] bg-white hover:border-black/20',
        className
      )}
      {...props}
    />
  );
}
