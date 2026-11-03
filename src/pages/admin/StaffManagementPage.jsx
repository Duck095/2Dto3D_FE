import { useEffect, useMemo, useRef, useState } from 'react';
import AdminField from '../../components/admin/AdminField';
import AdminTable from '../../components/admin/AdminTable';
import PopCard from '../../components/admin/PopCard';
import StatusBadge from '../../components/admin/StatusBadge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonLine } from '../../components/ui/Skeleton';
import {
  buildStaffListParams,
  getAccountStatusLabel,
  getAllowedStaffTransitions,
  getStaffApiErrorMessage,
  getStaffCollectionState,
  validateAndBuildCreateStaffPayload,
  validateAndBuildStaffUpdatePayload,
  validateAndBuildStatusPayload,
} from '../../features/admin/staff/staffManagement';
import { createStaffMutationRunner } from '../../features/admin/staff/staffMutationRunner';
import {
  changeStaffStatus,
  createStaff,
  getStaff,
  listStaff,
  updateStaff,
} from '../../features/admin/staff/staffService';
import './staff-management.css';

const STATUS_LABELS = {
  PENDING: 'Chờ xử lý',
  ACTIVE: 'Đang hoạt động',
  SUSPENDED: 'Tạm ngưng',
  TERMINATED: 'Đã kết thúc',
};
const STATUS_TONES = { PENDING: 'warning', ACTIVE: 'success', SUSPENDED: 'danger', TERMINATED: 'neutral' };

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN').format(date);
}

function formatTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function StaffStatus({ status }) {
  return <StatusBadge tone={STATUS_TONES[status] || 'neutral'}>{STATUS_LABELS[status] || status || 'Chưa xác định'}</StatusBadge>;
}

function AccountStatus({ status }) {
  return <StatusBadge tone={status === 'ACTIVE' ? 'success' : 'neutral'}>{getAccountStatusLabel(status)}</StatusBadge>;
}

function DetailItem({ label, children }) {
  return <div className="admin-staff-detail-item"><dt>{label}</dt><dd>{children || '—'}</dd></div>;
}

export default function StaffManagementPage() {
  const [listState, setListState] = useState({
    items: [], page: 0, size: 20, totalElements: null, totalPages: 0, loading: true, error: null,
  });
  const [filterDraft, setFilterDraft] = useState({ query: '', status: '', department: '' });
  const [filters, setFilters] = useState({ query: '', status: '', department: '' });
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [reloadList, setReloadList] = useState(0);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [detailReload, setDetailReload] = useState(0);
  const [detailState, setDetailState] = useState({ staff: null, loading: false, error: null });
  const [formMode, setFormMode] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [mutation, setMutation] = useState({ loading: false, error: '', success: '' });
  const mutationRunnerRef = useRef(null);
  const mountedRef = useRef(true);
  if (!mutationRunnerRef.current) mutationRunnerRef.current = createStaffMutationRunner();

  const params = useMemo(() => buildStaffListParams({ ...filters, page: pageIndex, size: pageSize }), [filters, pageIndex, pageSize]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mutationRunnerRef.current.invalidate();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setListState(current => ({ ...current, items: [], totalElements: null, loading: true, error: null }));
    listStaff(params, { signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(response?.content)) throw new Error('Invalid staff page response');
      setListState({
        items: response.content,
        page: Number.isInteger(response.page) ? response.page : pageIndex,
        size: Number.isInteger(response.size) ? response.size : pageSize,
        totalElements: Number.isFinite(response.totalElements) ? response.totalElements : response.content.length,
        totalPages: Number.isInteger(response.totalPages) ? response.totalPages : 0,
        loading: false,
        error: null,
      });
    }).catch(error => {
      if (error.name === 'AbortError' || controller.signal.aborted) return;
      setListState(current => ({ ...current, items: [], loading: false, error }));
    });
    return () => controller.abort();
  }, [params, pageIndex, pageSize, reloadList]);

  useEffect(() => {
    if (selectedStaffId == null) {
      setDetailState({ staff: null, loading: false, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setDetailState({ staff: null, loading: true, error: null });
    getStaff(selectedStaffId, { signal: controller.signal }).then(staff => {
      if (controller.signal.aborted) return;
      setDetailState({ staff, loading: false, error: null });
    }).catch(error => {
      if (error.name === 'AbortError' || controller.signal.aborted) return;
      setDetailState({ staff: null, loading: false, error });
    });
    return () => controller.abort();
  }, [selectedStaffId, detailReload]);

  const collectionState = getStaffCollectionState(listState);
  const currentPage = Number.isInteger(listState.page) ? listState.page : pageIndex;
  const canGoPrevious = currentPage > 0 && !listState.loading;
  const canGoNext = currentPage + 1 < listState.totalPages && !listState.loading;

  const openCreateForm = () => {
    mutationRunnerRef.current.invalidate();
    setSelectedStaffId(null);
    setFormMode('create');
    setFormValues({ userId: '', employeeNumber: '', department: '', jobTitle: '', joinedAt: '' });
    setFormErrors({});
    setMutation({ loading: mutationRunnerRef.current.isInFlight(), error: '', success: '' });
  };

  const openStaffDetail = staff => {
    mutationRunnerRef.current.invalidate();
    setFormMode(null);
    setSelectedStaffId(staff.id);
    setMutation({ loading: mutationRunnerRef.current.isInFlight(), error: '', success: '' });
  };

  const openEditForm = staff => {
    mutationRunnerRef.current.invalidate();
    setFormMode('edit');
    setFormValues({ department: staff.department || '', jobTitle: staff.jobTitle || '', joinedAt: staff.joinedAt || '' });
    setFormErrors({});
    setMutation({ loading: mutationRunnerRef.current.isInFlight(), error: '', success: '' });
  };

  const openStatusForm = staff => {
    mutationRunnerRef.current.invalidate();
    const allowed = getAllowedStaffTransitions(staff.status);
    setFormMode('status');
    setFormValues({ status: allowed[0] || '', reason: '' });
    setFormErrors({});
    setMutation({ loading: mutationRunnerRef.current.isInFlight(), error: '', success: '' });
  };

  const handleFormChange = event => {
    const { name, value } = event.target;
    setFormValues(current => ({ ...current, [name]: value }));
    setFormErrors(current => ({ ...current, [name]: undefined, form: undefined }));
  };

  const handleMutationSubmit = async event => {
    event.preventDefault();
    if (mutationRunnerRef.current.isInFlight()) return;
    const staff = detailState.staff;
    const result = formMode === 'create'
      ? validateAndBuildCreateStaffPayload(formValues)
      : formMode === 'edit'
        ? validateAndBuildStaffUpdatePayload(formValues, staff)
        : validateAndBuildStatusPayload(staff?.status, formValues.status, formValues.reason);
    setFormErrors(result.errors);
    if (!result.payload) return;

    setMutation({ loading: true, error: '', success: '' });
    const operationMode = formMode;
    await mutationRunnerRef.current.run({
      request: () => operationMode === 'create'
        ? createStaff(result.payload)
        : operationMode === 'edit'
          ? updateStaff(staff.id, result.payload)
          : changeStaffStatus(staff.id, result.payload),
      onSuccess: response => {
        if (operationMode !== 'create' && response?.id) setDetailState({ staff: response, loading: false, error: null });
        const success = operationMode === 'create'
          ? 'Đã tạo hồ sơ nhân sự. Trạng thái ban đầu do Backend đặt là Chờ xử lý.'
          : operationMode === 'edit' ? 'Đã cập nhật hồ sơ nhân sự.' : 'Đã gửi yêu cầu đổi trạng thái.';
        setFormMode(null);
        setMutation({ loading: false, error: '', success });
      },
      onError: error => setMutation({ loading: false, error: getStaffApiErrorMessage(error), success: '' }),
      onSettled: outcome => {
        if (outcome?.succeeded && mountedRef.current) setReloadList(value => value + 1);
        if (outcome?.stale && mountedRef.current) setMutation({ loading: false, error: '', success: '' });
      },
    });
  };

  const handleFilterSubmit = event => {
    event.preventDefault();
    setFilters({ ...filterDraft });
    setPageIndex(0);
    setReloadList(value => value + 1);
  };

  const closeForm = () => {
    mutationRunnerRef.current.invalidate();
    setFormMode(null);
    setFormErrors({});
  };

  const renderStaffForm = staff => {
    if (!formMode) return null;
    const isCreate = formMode === 'create';
    const isEdit = formMode === 'edit';
    const allowedTransitions = staff ? getAllowedStaffTransitions(staff.status) : [];
    const title = isCreate ? 'Tạo hồ sơ nhân sự' : isEdit ? 'Chỉnh sửa hồ sơ' : 'Thay đổi trạng thái';
    return (
      <PopCard as="section" tone="lavender" className="admin-staff-form-card" aria-labelledby="admin-staff-form-title">
        <div className="admin-staff-section-heading">
          <div><p className="admin-staff-eyebrow">{isCreate ? 'HỒ SƠ MỚI' : 'CẬP NHẬT HỒ SƠ'}</p><h3 id="admin-staff-form-title">{title}</h3></div>
          <Button type="button" variant="ghost" size="sm" onClick={closeForm}>Đóng</Button>
        </div>
        <form className="admin-staff-form" onSubmit={handleMutationSubmit} noValidate aria-busy={mutation.loading}>
          {isCreate ? (
            <>
              <AdminField label="ID tài khoản hiện có" name="userId" value={formValues.userId || ''} onChange={handleFormChange} inputMode="numeric" hint="Nhập ID User đã tồn tại. Hệ thống chưa có API tìm/chọn User; không tạo tài khoản mới từ màn hình này." error={formErrors.userId} required disabled={mutation.loading} />
              <AdminField label="Mã nhân viên" name="employeeNumber" value={formValues.employeeNumber || ''} onChange={handleFormChange} hint="3–32 ký tự chữ, số hoặc dấu gạch ngang. Mã được chuẩn hóa viết hoa." error={formErrors.employeeNumber} required disabled={mutation.loading} />
            </>
          ) : null}

          {formMode === 'status' ? (
            <>
              <AdminField as="select" label="Trạng thái tiếp theo" name="status" value={formValues.status || ''} onChange={handleFormChange} error={formErrors.status} required disabled={mutation.loading}>
                {allowedTransitions.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
              </AdminField>
              <div className="admin-field">
                <label className="admin-field__label" htmlFor="admin-staff-reason">Lý do thay đổi <span aria-hidden="true">*</span></label>
                <textarea id="admin-staff-reason" className={`admin-field__control${formErrors.reason ? ' admin-field__control--error' : ''}`} name="reason" value={formValues.reason || ''} onChange={handleFormChange} rows={3} maxLength={500} required disabled={mutation.loading} aria-invalid={formErrors.reason ? 'true' : undefined} aria-describedby={formErrors.reason ? 'admin-staff-reason-error' : 'admin-staff-reason-hint'} />
                {formErrors.reason ? <p className="admin-field__error" id="admin-staff-reason-error">{formErrors.reason}</p> : <p className="admin-field__hint" id="admin-staff-reason-hint">Bắt buộc, tối đa 500 ký tự.</p>}
              </div>
            </>
          ) : (
            <>
              <AdminField label="Phòng ban" name="department" value={formValues.department || ''} onChange={handleFormChange} maxLength={100} error={formErrors.department} required disabled={mutation.loading} />
              <AdminField label="Chức danh" name="jobTitle" value={formValues.jobTitle || ''} onChange={handleFormChange} maxLength={120} error={formErrors.jobTitle} required disabled={mutation.loading} />
              <AdminField label="Ngày gia nhập" name="joinedAt" type="date" value={formValues.joinedAt || ''} onChange={handleFormChange} error={formErrors.joinedAt} required disabled={mutation.loading} />
            </>
          )}
          {formErrors.form && <p className="admin-staff-form-error" role="alert">{formErrors.form}</p>}
          <div className="admin-staff-form-actions">
            <Button type="button" variant="outline" onClick={closeForm} disabled={mutation.loading}>Hủy</Button>
            <Button type="submit" variant="primary" loading={mutation.loading} disabled={mutation.loading}>
              {mutation.loading ? 'Đang lưu' : isCreate ? 'Tạo hồ sơ' : isEdit ? 'Lưu hồ sơ' : 'Xác nhận đổi trạng thái'}
            </Button>
          </div>
        </form>
      </PopCard>
    );
  };

  return (
    <div className="admin-staff-page">
      <header className="admin-page-heading admin-staff-heading">
        <div><p className="admin-page-heading__eyebrow">ĐIỀU HÀNH / NHÂN SỰ</p><h2>Quản lý nhân sự</h2><p>Tra cứu và quản lý hồ sơ nhân viên từ hệ thống.</p></div>
        <Button variant="primary" onClick={openCreateForm}>Tạo hồ sơ</Button>
      </header>

      {mutation.success && <p className="admin-staff-feedback admin-staff-feedback--success" role="status" aria-live="polite">{mutation.success}</p>}
      {mutation.error && <p className="admin-staff-feedback admin-staff-feedback--error" role="alert">{mutation.error}</p>}

      {formMode === 'create' && renderStaffForm(null)}

      <PopCard as="section" tone="plain" className="admin-staff-directory" aria-labelledby="admin-staff-directory-title">
        <div className="admin-staff-section-heading">
          <div><p className="admin-staff-eyebrow">DANH BẠ NỘI BỘ</p><h3 id="admin-staff-directory-title">Nhân viên</h3></div>
          <span className="admin-staff-count">{listState.totalElements == null ? (listState.loading ? 'Đang tải…' : '—') : `${listState.totalElements} hồ sơ`}</span>
        </div>
        <form className="admin-staff-filters" onSubmit={handleFilterSubmit}>
          <AdminField label="Tìm kiếm" name="query" value={filterDraft.query} onChange={event => setFilterDraft(current => ({ ...current, query: event.target.value }))} placeholder="Tên, email hoặc mã nhân viên" />
          <AdminField as="select" label="Trạng thái" name="status" value={filterDraft.status} onChange={event => setFilterDraft(current => ({ ...current, status: event.target.value }))}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
          </AdminField>
          <AdminField label="Phòng ban" name="department" value={filterDraft.department} onChange={event => setFilterDraft(current => ({ ...current, department: event.target.value }))} placeholder="Nhập tên phòng ban" />
          <div className="admin-staff-filter-actions"><Button type="submit" variant="primary" disabled={listState.loading}>Lọc danh sách</Button></div>
        </form>

        {collectionState === 'loading' && (
          <div className="admin-staff-loading" role="status" aria-live="polite" aria-label="Đang tải danh sách nhân sự">
            <SkeletonLine height="h-5" width="w-1/3" />
            <SkeletonLine height="h-12" />
            <SkeletonLine height="h-12" />
            <SkeletonLine height="h-12" />
          </div>
        )}
        {collectionState === 'error' && <ErrorState title="Không thể tải danh sách nhân sự" message={getStaffApiErrorMessage(listState.error)} onRetry={() => setReloadList(value => value + 1)} />}
        {collectionState === 'empty' && (
          <EmptyState icon="group_off" title="Chưa có hồ sơ phù hợp" description="Thử đổi từ khóa hoặc bộ lọc. Dữ liệu sẽ xuất hiện khi Backend trả về hồ sơ nhân sự." />
        )}
        {collectionState === 'table' && (
          <>
            <AdminTable label="Danh sách nhân sự" aria-busy={listState.loading}>
              <thead><tr><th scope="col">Nhân viên</th><th scope="col">Mã nhân viên</th><th scope="col">Phòng ban</th><th scope="col">Chức danh</th><th scope="col">Trạng thái</th><th scope="col"><span className="admin-sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {listState.items.map(staff => (
                  <tr key={staff.id}>
                    <th scope="row"><span className="admin-staff-name">{staff.name || '—'}</span><span className="admin-staff-email">{staff.email || '—'}</span></th>
                    <td>{staff.employeeNumber || '—'}</td><td>{staff.department || '—'}</td><td>{staff.jobTitle || '—'}</td>
                    <td><StaffStatus status={staff.status} /></td>
                    <td><Button type="button" variant="outline" size="sm" onClick={() => openStaffDetail(staff)} aria-label={`Xem hồ sơ ${staff.name || staff.employeeNumber}`}>Xem hồ sơ</Button></td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <div className="admin-staff-pagination" aria-label="Phân trang danh sách nhân sự">
              <span>Trang {listState.totalPages ? currentPage + 1 : 0} / {listState.totalPages} · {listState.totalElements} hồ sơ</span>
              <AdminField as="select" label="Số dòng mỗi trang" name="pageSize" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPageIndex(0); }}>
                {[10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}
              </AdminField>
              <div className="admin-staff-pagination-actions">
                <Button type="button" variant="outline" size="sm" disabled={!canGoPrevious} onClick={() => setPageIndex(Math.max(0, currentPage - 1))}>Trước</Button>
                <Button type="button" variant="outline" size="sm" disabled={!canGoNext} onClick={() => setPageIndex(currentPage + 1)}>Tiếp</Button>
              </div>
            </div>
          </>
        )}
      </PopCard>

      {selectedStaffId != null && (
        <PopCard as="section" tone="cyan" className="admin-staff-detail-card" aria-labelledby="admin-staff-detail-title" aria-busy={detailState.loading}>
          {detailState.loading && <div role="status" aria-live="polite"><SkeletonLine height="h-5" width="w-1/3" /><SkeletonLine height="h-12" /></div>}
          {detailState.error && <ErrorState title="Không thể tải hồ sơ" message={getStaffApiErrorMessage(detailState.error)} onRetry={() => setDetailReload(value => value + 1)} />}
          {detailState.staff && (
            <>
              <div className="admin-staff-section-heading">
                <div><p className="admin-staff-eyebrow">CHI TIẾT HỒ SƠ</p><h3 id="admin-staff-detail-title">{detailState.staff.name || 'Hồ sơ nhân sự'}</h3><p className="admin-staff-email">{detailState.staff.email || '—'}</p></div>
                <div className="admin-staff-detail-heading-actions"><StaffStatus status={detailState.staff.status} /><Button type="button" variant="ghost" size="sm" onClick={() => { mutationRunnerRef.current.invalidate(); setSelectedStaffId(null); setFormMode(null); }}>Đóng</Button></div>
              </div>
              <dl className="admin-staff-detail-grid">
                <DetailItem label="ID hồ sơ">{detailState.staff.id}</DetailItem><DetailItem label="ID tài khoản">{detailState.staff.userId}</DetailItem>
                <DetailItem label="Mã nhân viên">{detailState.staff.employeeNumber}</DetailItem><DetailItem label="Vai trò tài khoản">{detailState.staff.role}</DetailItem>
                <DetailItem label="Trạng thái tài khoản"><AccountStatus status={detailState.staff.accountStatus} /></DetailItem><DetailItem label="Phòng ban">{detailState.staff.department}</DetailItem>
                <DetailItem label="Chức danh">{detailState.staff.jobTitle}</DetailItem><DetailItem label="Ngày gia nhập">{formatDate(detailState.staff.joinedAt)}</DetailItem>
                <DetailItem label="Người tạo (ID)">{detailState.staff.createdBy}</DetailItem><DetailItem label="Ngày tạo">{formatTimestamp(detailState.staff.createdAt)}</DetailItem>
                <DetailItem label="Cập nhật bởi (ID)">{detailState.staff.updatedBy}</DetailItem><DetailItem label="Ngày cập nhật">{formatTimestamp(detailState.staff.updatedAt)}</DetailItem>
              </dl>
              <div className="admin-staff-detail-actions">
                <Button type="button" variant="outline" onClick={() => openEditForm(detailState.staff)}>Chỉnh sửa hồ sơ</Button>
                {getAllowedStaffTransitions(detailState.staff.status).length > 0
                  ? <Button type="button" variant="secondary" onClick={() => openStatusForm(detailState.staff)}>Đổi trạng thái</Button>
                  : <span className="admin-staff-terminal-note">Hồ sơ đã kết thúc, không thể chuyển trạng thái tiếp.</span>}
              </div>
            </>
          )}
          {renderStaffForm(detailState.staff)}
        </PopCard>
      )}
    </div>
  );
}
