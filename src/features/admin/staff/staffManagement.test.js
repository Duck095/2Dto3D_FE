import assert from 'node:assert/strict';
import test from 'node:test';

let rules = {};
try {
  rules = await import('./staffManagement.js');
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

const validCreate = {
  userId: '42',
  employeeNumber: ' emp-042 ',
  department: ' Design ',
  jobTitle: ' Maker ',
  joinedAt: '2026-02-14',
};

test('staff status transitions match the Backend lifecycle exactly', () => {
  assert.equal(typeof rules.getAllowedStaffTransitions, 'function');
  assert.deepEqual(rules.getAllowedStaffTransitions('PENDING'), ['ACTIVE', 'TERMINATED']);
  assert.deepEqual(rules.getAllowedStaffTransitions('ACTIVE'), ['SUSPENDED', 'TERMINATED']);
  assert.deepEqual(rules.getAllowedStaffTransitions('SUSPENDED'), ['ACTIVE', 'TERMINATED']);
  assert.deepEqual(rules.getAllowedStaffTransitions('TERMINATED'), []);
  assert.deepEqual(rules.getAllowedStaffTransitions('UNKNOWN'), []);
});

test('staff list params omit empty filters and preserve backend pagination', () => {
  assert.equal(typeof rules.buildStaffListParams, 'function');
  assert.deepEqual(rules.buildStaffListParams({ page: 2, size: 10, query: '  Linh ', status: '', department: '  ' }), {
    page: 2,
    size: 10,
    query: 'Linh',
  });
});

test('create payload validates account ID and required profile fields without setting status', () => {
  assert.equal(typeof rules.validateAndBuildCreateStaffPayload, 'function');
  assert.deepEqual(rules.validateAndBuildCreateStaffPayload(validCreate), {
    payload: {
      userId: 42,
      employeeNumber: 'EMP-042',
      department: 'Design',
      jobTitle: 'Maker',
      joinedAt: '2026-02-14',
    },
    errors: {},
  });
  const invalid = rules.validateAndBuildCreateStaffPayload({ ...validCreate, userId: '0', joinedAt: '2026-02-30' });
  assert.equal(invalid.payload, null);
  assert.ok(invalid.errors.userId);
  assert.ok(invalid.errors.joinedAt);
});

test('update payload contains only editable and changed fields', () => {
  assert.equal(typeof rules.validateAndBuildStaffUpdatePayload, 'function');
  const current = { department: 'Design', jobTitle: 'Maker', joinedAt: '2026-02-14', employeeNumber: 'EMP-042' };
  assert.deepEqual(rules.validateAndBuildStaffUpdatePayload({
    department: ' Operations ',
    jobTitle: 'Maker',
    joinedAt: '2026-02-14',
    employeeNumber: 'SHOULD-NOT-SEND',
    userId: 99,
  }, current), {
    payload: { department: 'Operations' },
    errors: {},
  });
  assert.equal(rules.validateAndBuildStaffUpdatePayload(current, current).payload, null);
});

test('status change requires a valid transition and a nonblank reason of at most 500 characters', () => {
  assert.equal(typeof rules.validateAndBuildStatusPayload, 'function');
  assert.deepEqual(rules.validateAndBuildStatusPayload('PENDING', 'ACTIVE', ' Approved onboarding '), {
    payload: { status: 'ACTIVE', reason: 'Approved onboarding' },
    errors: {},
  });
  assert.equal(rules.validateAndBuildStatusPayload('TERMINATED', 'ACTIVE', 'Reason').payload, null);
  assert.equal(rules.validateAndBuildStatusPayload('ACTIVE', 'SUSPENDED', ' ').payload, null);
  assert.equal(rules.validateAndBuildStatusPayload('ACTIVE', 'TERMINATED', 'x'.repeat(501)).payload, null);
});

test('staff request failures provide specific feedback for backend status codes', () => {
  assert.equal(typeof rules.getStaffApiErrorMessage, 'function');
  for (const [status, expected] of [
    [400, 'Kiểm tra lại thông tin'],
    [401, 'Phiên đăng nhập'],
    [403, 'không có quyền'],
    [404, 'không tìm thấy'],
    [409, 'xung đột'],
  ]) {
    assert.ok(rules.getStaffApiErrorMessage({ response: { status } }).toLocaleLowerCase().includes(expected.toLocaleLowerCase()));
  }
});

test('account status labels cover only the Backend UserStatus values', () => {
  assert.equal(typeof rules.getAccountStatusLabel, 'function');
  assert.equal(rules.getAccountStatusLabel('ACTIVE'), 'Hoạt động');
  assert.equal(rules.getAccountStatusLabel('UNACTIVE'), 'Không hoạt động');
  assert.equal(rules.getAccountStatusLabel('SUSPENDED'), 'SUSPENDED');
});

test('collection state distinguishes loading, error, empty and populated results', () => {
  assert.equal(typeof rules.getStaffCollectionState, 'function');
  assert.equal(rules.getStaffCollectionState({ loading: true, items: [], error: null }), 'loading');
  assert.equal(rules.getStaffCollectionState({ loading: false, items: [], error: new Error() }), 'error');
  assert.equal(rules.getStaffCollectionState({ loading: false, items: [], error: null }), 'empty');
  assert.equal(rules.getStaffCollectionState({ loading: false, items: [{}], error: null }), 'table');
});
