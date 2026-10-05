import { forwardRef } from 'react';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './styles';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, disabled, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading && (
        <span
          className={
            variant === 'primary' || variant === 'danger'
              ? 'h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white'
              : 'h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-ink'
          }
        />
      )}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
