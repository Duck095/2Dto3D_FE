// ─────────────────────────────────────────────
// Morphia — Skeleton loading components
//
// Usage:
//   <SkeletonCard />                  → Product card placeholder
//   <SkeletonLine width="w-3/4" />    → Text line placeholder
// ─────────────────────────────────────────────

const shimmer = 'animate-pulse bg-slate-200 rounded';

export function SkeletonLine({ width = 'w-full', height = 'h-4', className = '' }) {
  return <div className={`${shimmer} ${width} ${height} ${className}`} />;
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-4 ${className}`}>
      {/* Image placeholder */}
      <div className={`${shimmer} mb-4 h-48 w-full rounded-xl`} />
      {/* Title */}
      <SkeletonLine width="w-3/4" className="mb-2" />
      {/* Description */}
      <SkeletonLine width="w-1/2" height="h-3" className="mb-3" />
      {/* Price */}
      <SkeletonLine width="w-1/3" height="h-5" />
    </div>
  );
}

export function SkeletonGrid({ count = 8, className = '' }) {
  return (
    <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
