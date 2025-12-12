export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-4">
        {/* Animated Logo */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--accent-primary)]/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent-primary)] animate-spin" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/10 flex items-center justify-center">
            <span className="text-xl font-bold text-[var(--accent-primary)]">T</span>
          </div>
        </div>

        {/* Loading text */}
        <p className="text-sm text-[var(--text-muted)] animate-pulse">
          Loading...
        </p>
      </div>

      {/* Screen reader text */}
      <span className="sr-only">Loading application, please wait...</span>
    </div>
  );
}
