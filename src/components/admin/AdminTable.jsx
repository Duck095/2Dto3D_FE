export default function AdminTable({ label = 'Bảng dữ liệu', className = '', children, ...props }) {
  return (
    <div className={`admin-table-scroll ${className}`.trim()} role="region" aria-label={label} tabIndex={0}>
      <table className="admin-table" {...props}>
        <caption className="admin-sr-only">{label}</caption>
        {children}
      </table>
    </div>
  );
}
