import PopCard from '../../components/admin/PopCard';
import StatusBadge from '../../components/admin/StatusBadge';

export default function AdminOverviewPage() {
  return (
    <div className="admin-overview">
      <header className="admin-page-heading">
        <p className="admin-page-heading__eyebrow">ĐIỀU HÀNH</p>
        <h2>Tổng quan</h2>
        <p>Không gian quản trị 2Dto3D.</p>
      </header>

      <PopCard className="admin-overview__status" aria-labelledby="admin-overview-status-title">
        <div className="admin-overview__status-heading">
          <div>
            <p className="admin-overview__eyebrow">TRẠNG THÁI DỮ LIỆU</p>
            <h3 id="admin-overview-status-title">Chưa có dữ liệu tổng quan</h3>
          </div>
          <StatusBadge tone="warning">Chưa kết nối</StatusBadge>
        </div>
        <p>Chỉ hiển thị số liệu khi Admin API được triển khai và cung cấp dữ liệu xác thực.</p>
      </PopCard>
    </div>
  );
}
