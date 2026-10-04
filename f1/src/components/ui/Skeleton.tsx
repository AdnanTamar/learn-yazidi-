export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function SkeletonRows({ rows = 8, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <p className="eyebrow mb-4 flex items-center gap-2">
        <span className="timing-lights" aria-hidden><i className="on" /><i className="on" /><i /></span>
        {label}
      </p>
      <div className="glass divide-y divide-white/5 overflow-hidden p-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3.5">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-10 w-10 !rounded-full" />
            <Skeleton className="h-4 flex-1 max-w-[260px]" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCards({ n = 6, label, h = "h-56" }: { n?: number; label: string; h?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <p className="eyebrow mb-4 flex items-center gap-2">
        <span className="timing-lights" aria-hidden><i className="on" /><i className="on" /><i /></span>
        {label}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: n }, (_, i) => (
          <Skeleton key={i} className={`${h} !rounded-3xl`} />
        ))}
      </div>
    </div>
  );
}
