/** Placeholder plate that mirrors `Plate`, so lists fill in without a blank gap. */
export function PlateSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass-plate animate-pulse space-y-3 rounded-xl p-4">
      <div className="h-3 w-1/3 rounded-full bg-muted/60" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-full bg-muted/40"
          style={{ width: `${100 - i * 14}%` }}
        />
      ))}
    </div>
  );
}

export function CardSkeletonList({ count = 4, lines = 3 }: { count?: number; lines?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <PlateSkeleton key={i} lines={lines} />
      ))}
    </div>
  );
}
