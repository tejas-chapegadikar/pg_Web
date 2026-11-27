import logo from '@/assets/logo-mark.svg';

// Shown to visitors when the site is in Maintenance mode (Admin → Settings), or while MAINTENANCE is true in main.tsx
export default function Maintenance({ message }: { message?: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-4 font-display text-ink">
      <div className="w-full max-w-md text-center">
        <img src={logo} alt="" className="mx-auto h-10 w-auto" />
        <h1 className="mt-6 text-[28px] font-semibold tracking-tight">We’ll be back soon</h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
          {message || 'anieghar is down for a short update right now. Please check back in a little while.'}
        </p>
      </div>
    </main>
  );
}
