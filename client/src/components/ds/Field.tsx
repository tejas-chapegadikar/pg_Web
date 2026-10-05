import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inputClasses } from './styles';

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Shown at the right of the label row, e.g. "Forgot password?" */
  labelAction?: React.ReactNode;
  icon?: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, labelAction, icon, error, hint, id, type, className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const isPassword = type === 'password';

    return (
      <div className={className}>
        <div className="mb-1.5 flex items-center justify-between compact:mb-1">
          <label htmlFor={id} className="text-[13px] font-medium">
            {label}
          </label>
          {labelAction}
        </div>
        <div className="relative">
          {icon && <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted">{icon}</span>}
          <input
            ref={ref}
            id={id}
            type={isPassword && visible ? 'text' : type}
            aria-invalid={Boolean(error)}
            className={cn(
              inputClasses,
              'h-12 compact:h-11',
              icon ? 'pl-13' : 'pl-4',
              isPassword ? 'pr-13' : 'pr-4',
              error && 'border-red-300 bg-red-50/50'
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Hide password' : 'Show password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted transition-colors hover:text-ink"
            >
              {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          )}
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-red-500">{error}</p>
        ) : (
          hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>
        )}
      </div>
    );
  }
);
Field.displayName = 'Field';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: React.ReactNode;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, id, className, rows = 4, ...props }, ref) => (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={cn(inputClasses, 'resize-none px-4 py-3 leading-relaxed', error && 'border-red-300 bg-red-50/50')}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>
      )}
    </div>
  )
);
TextArea.displayName = 'TextArea';
