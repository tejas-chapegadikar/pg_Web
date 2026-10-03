import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { getFirebaseAuth, RecaptchaVerifier, signInWithPhoneNumber } from '@/lib/firebase';
import { homeFor, usePhoneLogin } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import type { ConfirmationResult } from 'firebase/auth';
import logo from '@/assets/logo-dark.png';

const COUNTRY_CODE = '+91';
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export function PhoneLoginPage() {
  const navigate = useNavigate();
  const phoneLogin = usePhoneLogin();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(homeFor(user.role));
    }
  }, [isAuthenticated, user, navigate]);

  // Step 1 — phone entry
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [sendError, setSendError] = useState('');

  // Step 2 — OTP
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const setupRecaptcha = useCallback(() => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(getFirebaseAuth(), 'recaptcha-container', {
        size: 'invisible',
      });
    }
    return recaptchaRef.current;
  }, []);

  const sendOtp = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setSendError('Please enter a valid 10-digit phone number.');
      return;
    }
    setSendError('');
    setSendingOtp(true);
    try {
      const verifier = setupRecaptcha();
      const fullPhone = `${COUNTRY_CODE}${cleaned}`;
      const confirmation = await signInWithPhoneNumber(getFirebaseAuth(), fullPhone, verifier);
      confirmationRef.current = confirmation;
      setStep('otp');
      setCountdown(RESEND_COOLDOWN);
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'auth/too-many-requests') {
        setSendError('Too many attempts. Please wait a while before trying again.');
      } else {
        setSendError('Failed to send OTP. Please check your number and try again.');
      }
      // Reset recaptcha so it can be retried
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setSendingOtp(false);
    }
  };

  const resendOtp = async () => {
    setOtp(Array(OTP_LENGTH).fill(''));
    setVerifyError('');
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
    await sendOtp();
  };

  const verifyOtp = async (otpOverride?: string[]) => {
    const code = (otpOverride ?? otp).join('');
    if (code.length < OTP_LENGTH) {
      setVerifyError('Please enter the complete 6-digit OTP.');
      return;
    }
    if (!confirmationRef.current) {
      setVerifyError('Session expired. Please go back and resend OTP.');
      return;
    }
    setVerifyError('');
    setVerifying(true);
    try {
      const result = await confirmationRef.current.confirm(code);
      const idToken = await result.user.getIdToken();
      const res = await phoneLogin.mutateAsync(idToken);
      navigate(homeFor(res.data.user.role));
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'auth/invalid-verification-code') {
        setVerifyError('Incorrect OTP. Please check and try again.');
      } else if (error.code === 'auth/code-expired') {
        setVerifyError('OTP has expired. Please resend a new one.');
      } else {
        setVerifyError('Verification failed. Please try again.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Accept only digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    // Auto-advance
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all filled — pass newOtp directly to avoid stale closure
    if (digit && index === OTP_LENGTH - 1 && newOtp.every(Boolean)) {
      setTimeout(() => verifyOtp(newOtp), 100);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newOtp = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((d, i) => { newOtp[i] = d; });
    setOtp(newOtp);
    // Focus last filled box
    const lastIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    otpRefs.current[lastIndex]?.focus();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-sky-500/5 blur-[120px]" />
      </div>

      {/* Invisible reCAPTCHA mount point */}
      <div id="recaptcha-container" />

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Back button */}
        <button
          id="phone-login-back"
          onClick={() => step === 'otp' ? setStep('phone') : navigate('/login')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800 font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 'otp' ? 'Change number' : 'Back to login'}
        </button>

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex justify-center">
            <Link to="/" className="hover:opacity-90 transition-opacity duration-200">
              <img src={logo} className="h-[64px] w-auto object-contain" alt="Anei Ghar Logo" />
            </Link>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {step === 'phone' ? 'Enter your phone' : 'Verify your number'}
          </h1>
          <p className="mt-1 text-slate-500 font-medium">
            {step === 'phone'
              ? "We'll send you a one-time verification code"
              : `Code sent to ${COUNTRY_CODE} ${phone}`}
          </p>
        </div>

        <div className="rounded-[20px] border border-slate-100 bg-white p-8 shadow-2xl premium-shadow">
          {/* ─── Step 1: Phone input ─────────────────────────────── */}
          {step === 'phone' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Phone Number</label>
                <div className="flex gap-2">
                  {/* Country code badge */}
                  <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">
                    🇮🇳 <span className="text-slate-400 font-semibold">{COUNTRY_CODE}</span>
                  </div>
                  <input
                    id="phone-input"
                    type="tel"
                    inputMode="numeric"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                      setSendError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-850 placeholder-slate-400 outline-none transition-all duration-200 focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                    maxLength={10}
                    autoFocus
                  />
                </div>
                {sendError && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-red-500">
                    <span className="mt-0.5">⚠</span> {sendError}
                  </p>
                )}
              </div>

              <button
                id="send-otp-btn"
                onClick={sendOtp}
                disabled={sendingOtp || phone.replace(/\D/g, '').length < 10}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition-all duration-200 hover:bg-blue-700 hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50 animate-pulse-glow cursor-pointer"
              >
                {sendingOtp ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Sending OTP…
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4" />
                    Send OTP
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-400">
                By continuing, you agree to receive an SMS. Standard rates may apply.
              </p>
            </div>
          )}

          {/* ─── Step 2: OTP verification ────────────────────────── */}
          {step === 'otp' && (
            <div className="space-y-6">
              {/* OTP boxes */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Enter 6-digit OTP</label>
                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      id={`otp-box-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoFocus={i === 0}
                      className={[
                        'h-12 w-12 rounded-xl border text-center text-lg font-bold outline-none transition-all duration-200',
                        digit
                          ? 'border-blue-500 bg-blue-50 shadow-sm shadow-blue-500/10 text-slate-900'
                          : 'border-slate-200 bg-white text-slate-800',
                        'focus:border-blue-500/80 focus:ring-4 focus:ring-blue-500/10',
                      ].join(' ')}
                    />
                  ))}
                </div>
                {verifyError && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-red-500 justify-center">
                    <span className="mt-0.5">⚠</span> {verifyError}
                  </p>
                )}
              </div>

              {/* Verify button */}
              <button
                id="verify-otp-btn"
                onClick={() => verifyOtp()}
                disabled={verifying || otp.join('').length < OTP_LENGTH}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition-all duration-200 hover:bg-blue-700 hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50 animate-pulse-glow cursor-pointer"
              >
                {verifying ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Verify &amp; Continue
                  </>
                )}
              </button>

              {/* Resend */}
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-slate-400">
                    Resend OTP in{' '}
                    <span className="font-bold text-blue-600">0:{String(countdown).padStart(2, '0')}</span>
                  </p>
                ) : (
                  <button
                    id="resend-otp-btn"
                    onClick={resendOtp}
                    className="flex items-center gap-1.5 mx-auto text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
