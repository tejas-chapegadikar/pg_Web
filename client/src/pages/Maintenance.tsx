// Shown instead of the whole app while MAINTENANCE is true in main.tsx
export default function Maintenance() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-backdrop px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-sm">
        <h1 className="font-display text-3xl font-semibold text-ink">Anei Ghar</h1>
        <p className="mt-6 text-lg font-medium text-ink">We'll be back soon</p>
        <p className="mt-2 text-muted">
          The site is down for maintenance right now. Please check back in a little while.
        </p>
      </div>
    </main>
  )
}
