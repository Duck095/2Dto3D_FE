import assert from 'node:assert/strict';
import test from 'node:test';

let ADMIN_NAVIGATION;
try {
  ({ ADMIN_NAVIGATION } = await import('./adminNavigation.js'));
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

const expectedGroups = [
  ['ĐIỀU HÀNH', ['Tổng quan', 'Nhân sự', 'Công việc', 'Nghiệm thu']],
  ['AI & 3D', ['AI Management', 'Thư viện 3D', 'Sản xuất & QA']],
  ['KINH DOANH', ['Sản phẩm', 'Đơn hàng', 'Thanh toán']],
  ['TÀI NGUYÊN', ['Vật liệu & Kho', 'Thiết bị in']],
  ['KHÁCH HÀNG', ['Khách hàng', 'Membership', 'Content & Marketing']],
  ['HỆ THỐNG', ['Cấu hình', 'Nhật ký & Giám sát']],
];

test('Admin navigation contains the approved six groups and seventeen entries in order', () => {
  assert.ok(Array.isArray(ADMIN_NAVIGATION), 'navigation configuration must exist');
  assert.deepEqual(ADMIN_NAVIGATION.map(group => [group.label, group.items.map(item => item.label)]), expectedGroups);
  assert.equal(ADMIN_NAVIGATION.reduce((count, group) => count + group.items.length, 0), 17);
});

test('only Tổng quan and the implemented Staff screen have destinations', () => {
  const items = ADMIN_NAVIGATION.flatMap(group => group.items);
  assert.deepEqual(items.filter(item => item.to).map(item => [item.label, item.to]), [
    ['Tổng quan', '/admin'],
    ['Nhân sự', '/admin/staff'],
  ]);
  assert.ok(items.filter(item => !item.to).every(item => item.available === false));
});
