import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getInternalAccessState, getPostLoginPath, isCurrentUserRequest } from './currentUserAccess.js';

const endpoints = await readFile(new URL('../../services/api/endpoints.js', import.meta.url), 'utf8');
const currentUserService = await readFile(new URL('./services/currentUserService.js', import.meta.url), 'utf8');

test('internal access waits for server verification and treats network failure as unavailable', () => {
  assert.equal(getInternalAccessState({ isLoading: true, isAuthenticated: true, status: 'loading' }, 'ADMIN'), 'loading');
  assert.equal(getInternalAccessState({ isLoading: false, isAuthenticated: true, status: 'error' }, 'ADMIN'), 'error');
  assert.equal(getInternalAccessState({ isLoading: false, isAuthenticated: true, status: 'forbidden' }, 'ADMIN'), 'forbidden');
});

const confirmed = (contexts) => ({ isLoading: false, isAuthenticated: true, status: 'verified', currentUser: { contexts } });

test('ADMIN with CUSTOMER and ADMIN contexts can access /admin', () => {
  assert.equal(getInternalAccessState(confirmed(['CUSTOMER', 'ADMIN']), 'ADMIN'), 'allowed');
});

test('USER with only CUSTOMER context cannot access /admin', () => {
  assert.equal(getInternalAccessState(confirmed(['CUSTOMER']), 'ADMIN'), 'forbidden');
});

test('DESIGNER with only CUSTOMER context cannot access /admin', () => {
  assert.equal(getInternalAccessState(confirmed(['CUSTOMER']), 'ADMIN'), 'forbidden');
});

test('ADMIN Phase 1 without EMPLOYEE context cannot access /employee', () => {
  assert.equal(getInternalAccessState(confirmed(['CUSTOMER', 'ADMIN']), 'EMPLOYEE'), 'forbidden');
});

test('unauthenticated sessions cannot access internal routes', () => {
  assert.equal(getInternalAccessState({ isLoading: false, isAuthenticated: false, status: 'verified' }, 'ADMIN'), 'unauthenticated');
});

test('missing or malformed contexts fail closed', () => {
  const confirmed = (currentUser) => ({ isLoading: false, isAuthenticated: true, status: 'verified', currentUser });
  for (const currentUser of [
    {},
    { contexts: null },
    { contexts: 'ADMIN' },
    { contexts: { ADMIN: true } },
    { contexts: ['ADMIN', null] },
    { contexts: [''] },
    { contexts: [] },
  ]) {
    assert.equal(getInternalAccessState(confirmed(currentUser), 'ADMIN'), 'forbidden');
  }
});

test('current-user API contract uses the existing client and v1 me endpoint', () => {
  assert.match(endpoints, /ME: '\/v1\/me'/);
  assert.match(currentUserService, /apiClient\.get\(ENDPOINTS\.AUTH\.ME\)/);
  assert.doesNotMatch(currentUserService, /axios\.create|context:\s*['"]ADMIN/);
});

test('a response applies only to the active token, session, and latest current-user request', () => {
  const request = { requestId: 2, sessionId: 7, token: 'session-token' };
  assert.equal(isCurrentUserRequest(request, { ...request }), true);
  assert.equal(isCurrentUserRequest(request, { ...request, requestId: 3 }), false);
  assert.equal(isCurrentUserRequest(request, { ...request, sessionId: 8 }), false);
  assert.equal(isCurrentUserRequest(request, { ...request, token: 'new-token' }), false);
});

test('post-login destination comes only from verified backend contexts', () => {
  assert.equal(getPostLoginPath({ contexts: ['CUSTOMER', 'ADMIN'] }), '/admin');
  assert.equal(getPostLoginPath({ contexts: ['CUSTOMER'] }), '/');
  assert.equal(getPostLoginPath({ role: 'ADMIN' }), null);
  assert.equal(getPostLoginPath({ contexts: 'ADMIN' }), null);
});
