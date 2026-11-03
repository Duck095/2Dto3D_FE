// ─────────────────────────────────────────────
// Morphia — Reusable Button component
//
// Variants: primary, secondary, outline, danger, ghost
// Sizes: sm, md, lg
//
// Usage:
//   <Button variant="primary">Generate</Button>
//   <Button variant="outline" size="sm">Cancel</Button>
//   <Button variant="danger" loading>Deleting...</Button>
// ─────────────────────────────────────────────

const baseClasses =
  'inline-flex items-center justify-center gap-2 font-bold whitespace-nowrap transition-all duration-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary';

const variants = {
  primary: 'btn-primary text-white',
  secondary: 'btn-secondary',
  outline:
    'border-1.5 border-slate-200 bg-white text-slate-700 hover:border-brand-primary hover:text-brand-primary hover:bg-brand-soft/30',
  danger:
    'bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
};

const sizes = {
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
