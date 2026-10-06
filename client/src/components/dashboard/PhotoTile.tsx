import { Loader2, Star, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One listing photo with a Cover / New badge and a remove button */
export function PhotoTile({
  src,
  cover,
  isNew,
  busy,
  label,
  onRemove,
  disabled,
}: {
  src: string;
  cover?: boolean;
  isNew?: boolean;
  busy?: boolean;
  label: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-[18px] bg-surface">
      <img src={src} alt="" className={cn('h-full w-full object-cover transition-opacity', busy && 'opacity-40')} />
      <div className="absolute left-2 top-2 flex gap-1.5">
        {cover && (
          <span className="flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium backdrop-blur-md">
            <Star className="h-3 w-3" /> Cover
          </span>
        )}
        {isNew && <span className="rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-medium text-white">New</span>}
      </div>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onRemove}
        disabled={disabled}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-md transition-colors hover:bg-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isNew ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4 text-red-600" />}
      </button>
    </div>
  );
}
