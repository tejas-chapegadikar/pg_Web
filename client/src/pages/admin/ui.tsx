import { forwardRef, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Pagination as PaginationInfo } from '@/api/admin';
import { initials } from './format';

/* Admin panel building blocks: white surfaces, black type and buttons, hairline grey borders. */

// ── Buttons ──────────────────────────────────────────────────────────────────

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-3.5 text-[13.5px]',
        variant === 'primary' && 'bg-ink text-white hover:bg-black/80',
        variant === 'secondary' && 'border border-black/10 bg-white text-ink hover:bg-black/[0.03]',
        variant === 'ghost' && 'text-ink/70 hover:bg-black/[0.04] hover:text-ink',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/60 transition-colors hover:bg-black/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-40',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Form fields ──────────────────────────────────────────────────────────────

export const inputClass =
  'h-9 w-full rounded-lg border border-black/10 bg-white px-3 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-black/35 focus:border-ink/60 focus:ring-2 focus:ring-black/5 disabled:bg-black/[0.03]';

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink/80">
        {label}
      </label>
      {children}
      {error ? <p className="text-[12px] text-red-600">{error}</p> : hint ? <p className="text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...rest} />;
});

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClass, 'cursor-pointer appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8', className)} style={{ backgroundImage: CHEVRON }} {...rest}>
      {children}
    </select>
  );
}
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111' stroke-opacity='.5' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'h-auto min-h-[88px] resize-y py-2 leading-relaxed', className)} {...rest} />;
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-50',
        checked ? 'bg-ink' : 'bg-black/15'
      )}
    >
      <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

/** Search box that reports after the person stops typing */
export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  const [text, setText] = useState(value);
  // Follow the value when it changes from outside (e.g. "Clear filters")
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), 300);
    return () => clearTimeout(t);
  }, [text, value, onChange]);
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
      <input type="search" aria-label={placeholder} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className={cn(inputClass, 'pl-9')} />
    </div>
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border border-black/[0.08] bg-white', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[22px] font-semibold tracking-tight sm:text-[24px]">{title}</h1>
        {description && <p className="mt-1 text-[13.5px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  neutral: 'bg-black/[0.05] text-ink/75',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-[#0046FF]/[0.07] text-[#0035c4]',
  dark: 'bg-ink text-white',
};
export type Tone = keyof typeof TONES;

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11.5px] font-medium', TONES[tone], className)}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, hint, loading }: { label: string; value?: number | string; hint?: ReactNode; loading?: boolean }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-[12.5px] text-muted">{label}</p>
      {loading ? (
        <div className="skeleton mt-2 h-7 w-16 rounded-md" />
      ) : (
        <p className="mt-1 font-display text-[26px] font-semibold leading-tight tracking-tight tabular-nums">
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value ?? '—'}
        </p>
      )}
      {hint && <p className="mt-0.5 text-[12px] text-muted">{hint}</p>}
    </Card>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <p className="text-[14px] font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[13px] text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-black/[0.06]">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-3.5">
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="skeleton h-4 rounded" style={{ width: c === 0 ? '28%' : `${12 + ((r + c) % 3) * 4}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Tables scroll sideways inside their card on narrow screens; the page itself never does */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">{children}</table>
    </div>
  );
}
export const th = 'whitespace-nowrap border-b border-black/[0.06] bg-black/[0.015] px-4 py-2.5 text-[12px] font-medium text-muted first:pl-5 last:pr-5';
export const td = 'border-b border-black/[0.05] px-4 py-3 align-middle first:pl-5 last:pr-5';

export function Pager({ info, onPage }: { info?: PaginationInfo; onPage: (p: number) => void }) {
  if (!info || info.total === 0) return null;
  const from = (info.page - 1) * info.limit + 1;
  const to = Math.min(info.total, info.page * info.limit);
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-[12.5px] text-muted">
      <span className="tabular-nums">
        {from.toLocaleString('en-IN')}–{to.toLocaleString('en-IN')} of {info.total.toLocaleString('en-IN')}
      </span>
      <div className="flex items-center gap-1">
        <IconButton label="Previous page" disabled={info.page <= 1} onClick={() => onPage(info.page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <span className="px-1 tabular-nums">
          {info.page} / {info.totalPages}
        </span>
        <IconButton label="Next page" disabled={info.page >= info.totalPages} onClick={() => onPage(info.page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

// ── Overlays ─────────────────────────────────────────────────────────────────

/** Esc closes, focus moves in on open and back to where it was on close, Tab stays inside */
function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () =>
      Array.from(node?.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])') ?? []).filter((el) => !el.hasAttribute('disabled'));
    (focusables()[0] ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);
  return ref;
}

export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useOverlay(open, onClose);
  const id = useId();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-black/30" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className="animate-fade-in relative w-full max-w-md rounded-xl bg-white shadow-2xl outline-none">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 id={id} className="text-[15px] font-semibold">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="px-5 pb-5 pt-2 text-[13.5px] text-ink/80">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-black/[0.06] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirm a destructive action, naming exactly what will happen */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  loading,
  danger = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  loading?: boolean;
  danger?: boolean;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="leading-relaxed">{body}</div>
      {children}
    </Dialog>
  );
}

/** Panel that slides in from the right, for looking at one record without leaving the list */
export function Drawer({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; children: ReactNode }) {
  const ref = useOverlay(open, onClose);
  const id = useId();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="animate-fade-in absolute inset-0 bg-black/25" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className="admin-drawer absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col bg-white shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
          <div className="min-w-0">
            <h2 id={id} className="truncate text-[15px] font-semibold">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-[12.5px] text-muted">{subtitle}</div>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Avatar({ name, src, size = 32 }: { name?: string; src?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  return src && !broken ? (
    <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[11px] font-semibold text-ink/70" style={{ width: size, height: size }}>
      {initials(name)}
    </span>
  );
}
