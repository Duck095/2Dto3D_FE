// ─────────────────────────────────────────────
// Morphia — Empty State component
//
// Usage:
//   <EmptyState
//     icon="search_off"
//     title="Không tìm thấy model"
//     description="Thử tìm kiếm với từ khóa khác"
//   />
// ─────────────────────────────────────────────

export default function EmptyState({
  icon = 'inbox',
  title = 'Không có dữ liệu',
  description = '',
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      <span className="material-symbols-outlined mb-4 text-[56px] text-slate-300">
        {icon}
      </span>
      <h3 className="mb-1 text-lg font-bold text-slate-700">{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm text-sm text-slate-400">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
