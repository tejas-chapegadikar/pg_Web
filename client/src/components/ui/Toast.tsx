import { useUIStore } from '@/stores/uiStore';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 font-display sm:left-auto sm:right-6 sm:translate-x-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="flex items-start gap-3 rounded-2xl bg-ink px-4 py-3.5 text-white shadow-[0_20px_50px_-20px_rgba(17,17,17,0.6)] animate-slide-in"
        >
          <span className="mt-0.5 shrink-0">
            {toast.variant === 'destructive' ? (
              <AlertCircle className="h-4 w-4 text-red-300" />
            ) : toast.variant === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            ) : (
              <Info className="h-4 w-4 text-white/70" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{toast.title}</p>
            {toast.description && <p className="mt-0.5 text-[13px] leading-normal text-white/70">{toast.description}</p>}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-white/50 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
