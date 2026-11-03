// ─────────────────────────────────────────────
// Morphia — Page-level loading spinner
// Shown as Suspense fallback while lazy routes load.
// ─────────────────────────────────────────────

export default function PageSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-pocket-plum border-t-transparent" />
        <p className="text-sm font-medium text-slate-400">Đang tải...</p>
      </div>
    </div>
  );
}
