import { useState } from 'react';
import { Briefcase, Check, GraduationCap, Phone, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUpdateProfile } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ds/Button';
import { inputClasses } from '@/components/ds/styles';

type Role = 'student' | 'owner';
type Step = 'name' | 'role' | 'phone';

interface OnboardingModalProps {
  onComplete?: () => void;
}

/** Asks new accounts for whatever their sign-up method didn't give us (name, role, phone). */
export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { user, accessToken, setAuth } = useAuthStore();
  const updateProfile = useUpdateProfile();

  // Phone-only accounts from the old phone page never picked a name or role
  const isPhoneUser = Boolean(user?.firebaseUid && !user?.email);
  const steps: Step[] = [];
  if (isPhoneUser && !user?.name) steps.push('name');
  if (isPhoneUser) steps.push('role');
  if (!isPhoneUser && !user?.phone) steps.push('phone');

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState(user?.name || '');
  const [role, setRole] = useState<Role>(user?.role || 'student');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!user || steps.length === 0) return null;

  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const finish = async (skipPhone = false) => {
    setSubmitting(true);
    try {
      const payload: { name?: string; role?: Role; phone?: string } = {};
      if (steps.includes('name')) payload.name = name.trim();
      if (steps.includes('role')) payload.role = role;
      if (steps.includes('phone') && !skipPhone && phone) payload.phone = `+91${phone}`;

      const res = await updateProfile.mutateAsync(payload);
      if (accessToken) setAuth(res.data.user, accessToken);
      onComplete?.();
    } catch {
      // Shown below via updateProfile.isError
    } finally {
      setSubmitting(false);
    }
  };

  const next = async () => {
    if (step === 'name' && !name.trim()) return;
    if (step === 'phone' && phone && !/^[6-9]\d{9}$/.test(phone)) {
      setPhoneError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (isLastStep) await finish();
    else setStepIndex((i) => i + 1);
  };

  const copy: Record<Step, { icon: React.ReactNode; title: string; text: string }> = {
    name: { icon: <User className="h-5 w-5" />, title: 'What should we call you?', text: 'Your name appears on your profile and requests.' },
    role: { icon: <Briefcase className="h-5 w-5" />, title: 'How will you use Anei Ghar?', text: 'You can’t switch later, so pick the one that fits.' },
    phone: {
      icon: <Phone className="h-5 w-5" />,
      title: 'Add your mobile number',
      text:
        user.role === 'owner'
          ? 'Students use it to reach you about your listings.'
          : 'Brokers use it to get back to you about your requests.',
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full max-w-md rounded-[28px] bg-white p-6 font-display text-ink shadow-2xl animate-fade-in sm:p-8"
      >
        <div className="flex items-center justify-between">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface">{copy[step].icon}</span>
          {steps.length > 1 && (
            <div className="flex gap-1.5">
              {steps.map((s, i) => (
                <span key={s} className={cn('h-[3px] rounded-full transition-all', i === stepIndex ? 'w-8 bg-ink' : 'w-4 bg-black/10')} />
              ))}
            </div>
          )}
        </div>
        <h2 id="onboarding-title" className="mt-5 text-[22px] font-semibold tracking-tight">
          {copy[step].title}
        </h2>
        <p className="mt-1 text-sm text-muted">{copy[step].text}</p>

        <div className="mt-6">
          {step === 'name' && (
            <input
              id="onboarding-name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && next()}
              autoFocus
              className={cn(inputClasses, 'h-12 px-4')}
            />
          )}

          {step === 'role' && (
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['student', 'Student', 'Looking for a place', GraduationCap],
                  ['owner', 'Broker / Agent', 'Listing places', Briefcase],
                ] as const
              ).map(([value, title, text, Icon]) => (
                <button
                  key={value}
                  type="button"
                  id={`onboarding-role-${value}`}
                  onClick={() => setRole(value)}
                  aria-pressed={role === value}
                  className={cn(
                    'relative flex flex-col items-start gap-2.5 rounded-[22px] border p-4 text-left transition-all',
                    role === value ? 'border-ink shadow-[0_14px_30px_-16px_rgba(17,17,17,0.45)]' : 'border-black/[0.07] hover:border-black/20'
                  )}
                >
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', role === value ? 'bg-ink text-white' : 'bg-surface')}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs text-muted">{text}</span>
                  </span>
                  {role === value && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-md bg-accent text-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {step === 'phone' && (
            <div>
              <div className="flex gap-2">
                <span className="flex h-12 items-center rounded-2xl bg-surface px-4 text-sm font-medium">+91</span>
                <input
                  id="onboarding-phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    setPhoneError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && next()}
                  autoFocus
                  className={cn(inputClasses, 'h-12 flex-1 px-4', phoneError && 'border-red-300 bg-red-50/50')}
                />
              </div>
              {phoneError && <p className="mt-1.5 text-xs text-red-500">{phoneError}</p>}
            </div>
          )}

          {updateProfile.isError && (
            <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">Couldn’t save that. Please try again.</p>
          )}
        </div>

        <div className="mt-6 space-y-2">
          <Button
            id="onboarding-next-btn"
            onClick={next}
            loading={submitting}
            disabled={(step === 'name' && !name.trim()) || (step === 'phone' && phone.length > 0 && phone.length < 10)}
            className="w-full"
          >
            {isLastStep ? 'Finish' : 'Continue'}
          </Button>
          {step === 'phone' && (
            <Button id="onboarding-skip-phone" variant="ghost" onClick={() => finish(true)} disabled={submitting} className="w-full text-muted">
              Skip for now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
