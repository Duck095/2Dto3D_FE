const unavailable = (id, label) => ({ id, label, to: null, available: false });

export const ADMIN_NAVIGATION = [
  {
    id: 'operations',
    label: 'ĐIỀU HÀNH',
    items: [
      { id: 'overview', label: 'Tổng quan', to: '/admin', available: true },
      { id: 'staff', label: 'Nhân sự', to: '/admin/staff', available: true },
      unavailable('tasks', 'Công việc'),
      unavailable('acceptance', 'Nghiệm thu'),
    ],
  },
  {
    id: 'ai-3d',
    label: 'AI & 3D',
    items: [
      unavailable('ai-management', 'AI Management'),
      unavailable('library-3d', 'Thư viện 3D'),
      unavailable('production-qa', 'Sản xuất & QA'),
    ],
  },
  {
    id: 'business',
    label: 'KINH DOANH',
    items: [
      unavailable('products', 'Sản phẩm'),
      unavailable('orders', 'Đơn hàng'),
      unavailable('payments', 'Thanh toán'),
    ],
  },
  {
    id: 'resources',
    label: 'TÀI NGUYÊN',
    items: [
      unavailable('materials-inventory', 'Vật liệu & Kho'),
      unavailable('print-equipment', 'Thiết bị in'),
    ],
  },
  {
    id: 'customers',
    label: 'KHÁCH HÀNG',
    items: [
      unavailable('customers', 'Khách hàng'),
      unavailable('membership', 'Membership'),
      unavailable('content-marketing', 'Content & Marketing'),
    ],
  },
  {
    id: 'system',
    label: 'HỆ THỐNG',
    items: [
      unavailable('configuration', 'Cấu hình'),
      unavailable('audit-monitoring', 'Nhật ký & Giám sát'),
    ],
  },
];
