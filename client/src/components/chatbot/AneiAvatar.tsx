import { cn } from '@/lib/utils';

/** Anei, the chat helper: a little house in the brand blue that blinks now and then (styles: .anei-eyes in index.css) */
export function AneiAvatar({ className, still = false }: { className?: string; still?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('h-9 w-9 shrink-0', className)} aria-hidden="true">
      <rect width="40" height="40" rx="13" fill="#E8EEFF" />
      <path
        d="M10 19.5 20 11l10 8.5V29a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 10 29Z"
        fill="#0046FF"
        stroke="#0046FF"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <g className={cn(!still && 'anei-eyes')}>
        <ellipse cx="16.5" cy="22.5" rx="1.7" ry="2" fill="#fff" />
        <ellipse cx="23.5" cy="22.5" rx="1.7" ry="2" fill="#fff" />
      </g>
      <path d="M17.2 26.6q2.8 2 5.6 0" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
