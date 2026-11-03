import InternalLayoutFrame from './InternalLayoutFrame';

export default function EmployeeLayout() {
  return (
    <InternalLayoutFrame
      section="Employee"
      title="Khu vực nhân viên"
      description="Không gian làm việc nội bộ. Nội dung chỉ được hiển thị khi Backend xác nhận quyền truy cập."
    />
  );
}
