import { useRef } from 'react';
import { cn } from '@/lib/utils';

const LENGTH = 6;

/** Six single-digit boxes: auto-advance, backspace to go back, paste a whole code */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  const update = (next: string) => {
    const code = next.replace(/\D/g, '').slice(0, LENGTH);
    onChange(code);
    if (code.length === LENGTH) onComplete?.(code);
  };

  return (
    <div className="flex gap-2" role="group" aria-label="6-digit code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={`otp-${i}`}
          aria-label={`Digit ${i + 1}`}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={LENGTH}
          value={digit}
          disabled={disabled}
          autoFocus={i === 0}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, '');
            if (!typed) return;
            // A paste or SMS autofill drops the whole code in; a keystroke into a filled box adds one digit
            const isPaste = (e.nativeEvent as InputEvent).inputType === 'insertFromPaste' || typed.length > 2;
            const next = (value.slice(0, i) + (isPaste ? typed : typed.slice(-1)) + (isPaste ? '' : value.slice(i + 1))).slice(0, LENGTH);
            update(next);
            refs.current[Math.min(isPaste ? next.length : i + 1, LENGTH - 1)]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              const at = digit ? i : Math.max(i - 1, 0);
              update(value.slice(0, at) + value.slice(at + 1));
              refs.current[at]?.focus();
            }
          }}
          // Keep the box's digit selected so typing replaces it
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.currentTarget.select()}
          className={cn(
            'h-12 w-full min-w-0 rounded-2xl border bg-surface text-center text-lg font-semibold outline-none transition-all compact:h-11',
            'focus:border-black/15 focus:bg-white focus:ring-4 focus:ring-black/[0.04]',
            invalid ? 'border-red-300 bg-red-50/50' : 'border-transparent'
          )}
        />
      ))}
    </div>
  );
}
