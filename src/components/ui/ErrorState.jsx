// ─────────────────────────────────────────────
// Morphia — Error State component
//
// Usage:
//   <ErrorState
//     message="Không thể tải dữ liệu"
//     onRetry={() => refetch()}
//   />
// ─────────────────────────────────────────────

import Button from './Button';

export default function ErrorState({
  icon = 'error_outline',
  title = 'Đã xảy ra lỗi',
  message = 'Không thể tải dữ liệu. Vui lòng thử lại.',
  onRetry,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      <span className="material-symbols-outlined mb-4 text-[56px] text-rose-300">
        {icon}
      </span>
      <h3 className="mb-1 text-lg font-bold text-slate-700">{title}</h3>
      <p className="mb-5 max-w-sm text-sm text-slate-400">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Thử lại
        </Button>
      )}
    </div>
  );
}
