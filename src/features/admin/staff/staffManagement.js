const STAFF_TRANSITIONS = Object.freeze({
  PENDING: Object.freeze(['ACTIVE', 'TERMINATED']),
  ACTIVE: Object.freeze(['SUSPENDED', 'TERMINATED']),
  SUSPENDED: Object.freeze(['ACTIVE', 'TERMINATED']),
  TERMINATED: Object.freeze([]),
});

const isValidDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export function getAllowedStaffTransitions(status) {
  return Object.hasOwn(STAFF_TRANSITIONS, status) ? STAFF_TRANSITIONS[status] : [];
}

export function getAccountStatusLabel(status) {
  if (status === 'ACTIVE') return 'Hoạt động';
  if (status === 'UNACTIVE') return 'Không hoạt động';
  return status || '—';
}

export function buildStaffListParams({ page = 0, size = 20, query = '', status = '', department = '' } = {}) {
  const params = {
    page: Number.isInteger(Number(page)) && Number(page) >= 0 ? Number(page) : 0,
    size: Number.isInteger(Number(size)) && Number(size) >= 1 && Number(size) <= 100 ? Number(size) : 20,
  };
  const cleanQuery = typeof query === 'string' ? query.trim() : '';
  const cleanStatus = typeof status === 'string' ? status.trim() : '';
  const cleanDepartment = typeof department === 'string' ? department.trim() : '';
  if (cleanQuery) params.query = cleanQuery;
  if (Object.hasOwn(STAFF_TRANSITIONS, cleanStatus)) params.status = cleanStatus;
  if (cleanDepartment) params.department = cleanDepartment;
  return params;
}

export function validateAndBuildCreateStaffPayload(values = {}) {
  const errors = {};
  const parsedUserId = typeof values.userId === 'string' && /^\d+$/.test(values.userId.trim())
    ? Number(values.userId.trim())
    : values.userId;
  const employeeNumber = typeof values.employeeNumber === 'string' ? values.employeeNumber.trim().toUpperCase() : '';
  const department = typeof values.department === 'string' ? values.department.trim() : '';
  const jobTitle = typeof values.jobTitle === 'string' ? values.jobTitle.trim() : '';

  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) errors.userId = 'Nhập ID tài khoản là số nguyên dương.';
  if (!/^[A-Z0-9-]{3,32}$/.test(employeeNumber)) errors.employeeNumber = 'Mã nhân viên phải có 3–32 ký tự chữ, số hoặc dấu gạch ngang.';
  if (!department || department.length > 100) errors.department = 'Phòng ban là bắt buộc và tối đa 100 ký tự.';
  if (!jobTitle || jobTitle.length > 120) errors.jobTitle = 'Chức danh là bắt buộc và tối đa 120 ký tự.';
  if (!isValidDate(values.joinedAt)) errors.joinedAt = 'Nhập ngày gia nhập hợp lệ.';

  if (Object.keys(errors).length) return { payload: null, errors };
  return {
    payload: { userId: parsedUserId, employeeNumber, department, jobTitle, joinedAt: values.joinedAt },
    errors,
  };
}

export function validateAndBuildStaffUpdatePayload(values = {}, currentStaff = {}) {
  const errors = {};
  const payload = {};
  for (const [field, maximum] of [['department', 100], ['jobTitle', 120]]) {
    if (typeof values[field] !== 'string') continue;
    const value = values[field].trim();
    if (value === (currentStaff[field] || '')) continue;
    if (!value || value.length > maximum) errors[field] = `Trường này là bắt buộc và tối đa ${maximum} ký tự.`;
    else payload[field] = value;
  }
  if (typeof values.joinedAt === 'string' && values.joinedAt !== currentStaff.joinedAt) {
    if (!isValidDate(values.joinedAt)) errors.joinedAt = 'Nhập ngày gia nhập hợp lệ.';
    else payload.joinedAt = values.joinedAt;
  }
  if (Object.keys(errors).length) return { payload: null, errors };
  if (!Object.keys(payload).length) return { payload: null, errors: { form: 'Chưa có thay đổi để lưu.' } };
  return { payload, errors };
}

export function validateAndBuildStatusPayload(currentStatus, nextStatus, reason) {
  const errors = {};
  const cleanReason = typeof reason === 'string' ? reason.trim() : '';
  if (!getAllowedStaffTransitions(currentStatus).includes(nextStatus)) {
    errors.status = 'Trạng thái này không thể chuyển theo quy trình nhân sự.';
  }
  if (!cleanReason || cleanReason.length > 500) errors.reason = 'Lý do là bắt buộc và tối đa 500 ký tự.';
  if (Object.keys(errors).length) return { payload: null, errors };
  return { payload: { status: nextStatus, reason: cleanReason }, errors };
}

export function getStaffApiErrorMessage(error) {
  const status = error?.response?.status;
  if (status === 400) return 'Kiểm tra lại thông tin nhân sự rồi thử lại.';
  if (status === 401) return 'Phiên đăng nhập không còn hợp lệ. Hãy đăng nhập lại.';
  if (status === 403) return 'Tài khoản hiện tại không có quyền quản lý nhân sự.';
  if (status === 404) return 'Không tìm thấy hồ sơ hoặc tài khoản được yêu cầu.';
  if (status === 409) return 'Dữ liệu đang xung đột hoặc trạng thái đã thay đổi. Tải lại và kiểm tra trước khi thử lại.';
  return 'Không thể hoàn tất yêu cầu nhân sự. Vui lòng thử lại.';
}

export function getStaffCollectionState({ loading, error, items } = {}) {
  if (loading) return 'loading';
  if (error) return 'error';
  return items?.length ? 'table' : 'empty';
}
