import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_LABEL, ROLES, type Role } from './authShared';

export function RolePicker({ label, value, onChange }: { label: string; value: Role; onChange: (role: Role) => void }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-3">
        {ROLES.map(({ value: r, title, description, icon: Icon }) => {
          const selected = value === r;
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={selected}
              id={`role-${r}`}
              onClick={() => onChange(r)}
              className={cn(
                'relative flex flex-col items-start gap-2.5 rounded-[22px] border bg-white p-4 text-left transition-all duration-200 compact:p-3.5 short:flex-row short:items-center short:gap-3 short:p-3 short:pr-10',
                selected
                  ? 'border-ink shadow-[0_14px_30px_-16px_rgba(17,17,17,0.45)]'
                  : 'border-black/[0.07] hover:border-black/20'
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                  selected ? 'bg-ink text-white' : 'bg-surface text-ink'
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted compact:hidden">{description}</span>
              </span>
              <span
                className={cn(
                  'absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
                  selected ? 'border-accent bg-accent text-white' : 'border-black/15'
                )}
              >
                {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  );
}

/** "This account is registered as a Broker / Agent. Sign in as Broker / Agent" */
export function RoleMismatchBanner({ actualRole, onSwitch }: { actualRole: Role; onSwitch: (role: Role) => void }) {
  return (
    <ErrorBanner>
      This account is registered as a {ROLE_LABEL[actualRole]}.{' '}
      <button type="button" onClick={() => onSwitch(actualRole)} className="font-semibold underline">
        Continue as {ROLE_LABEL[actualRole]}
      </button>
    </ErrorBanner>
  );
}
