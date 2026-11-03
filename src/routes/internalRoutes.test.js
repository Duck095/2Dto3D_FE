import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routes = await readFile(new URL('./AppRoutes.jsx', import.meta.url), 'utf8');
const guard = await readFile(new URL('./InternalAccessGuard.jsx', import.meta.url), 'utf8');
const frame = await readFile(new URL('../layouts/InternalLayoutFrame.jsx', import.meta.url), 'utf8');
const button = await readFile(new URL('../components/ui/Button.jsx', import.meta.url), 'utf8');
const endpoints = await readFile(new URL('../services/api/endpoints.js', import.meta.url), 'utf8');
const currentUserService = await readFile(new URL('../features/auth/services/currentUserService.js', import.meta.url), 'utf8');
const apiClient = await readFile(new URL('../services/api/apiClient.js', import.meta.url), 'utf8');
const auth401Policy = await readFile(new URL('../services/api/auth401Policy.js', import.meta.url), 'utf8');

test('admin and employee routes use the single existing router and backend contexts', () => {
  assert.equal((routes.match(/createBrowserRouter\(/g) || []).length, 1);
  assert.match(routes, /path: '\/admin',[\s\S]*?requiredContext="ADMIN"/);
  assert.match(routes, /path: '\/employee',[\s\S]*?requiredContext="EMPLOYEE"/);
  assert.match(routes, /path: '\/admin',[\s\S]*?children:\s*\[[\s\S]*?path:\s*'staff'[\s\S]*?StaffManagementPage/);
  assert.match(guard, /getInternalAccessState/);
  assert.match(guard, /<Navigate to="\/login"/);
  assert.match(guard, /onRetry=\{verifyCurrentUser\}/);
});

test('current-user endpoint reuses the canonical API client and endpoint registry', () => {
  assert.match(endpoints, /ME: '\/v1\/me'/);
  assert.match(currentUserService, /apiClient\.get\(ENDPOINTS\.AUTH\.ME\)/);
  assert.doesNotMatch(currentUserService, /axios\.create/);
  assert.match(apiClient, /shouldRevalidateIdentityOn401/);
  assert.match(apiClient, /AUTH_IDENTITY_REVALIDATION_EVENT/);
  assert.doesNotMatch(apiClient, /clearStoredAuth|window\.location\.replace/);
  assert.match(auth401Policy, /path === '\/v1\/me'/);
  assert.match(auth401Policy, /isWithinPath\(path, '\/memberships'\)/);
});

test('internal layout stays responsive, keyboard reachable, and has no unimplemented feature menu', () => {
  assert.match(frame, /md:flex/);
  assert.match(frame, /sm:px-6/);
  assert.match(button, /focus-visible/);
  assert.match(frame, /onClick=\{signOut\}/);
  assert.doesNotMatch(frame, /Staff Management|Task Management|Submission|Approval/);
});
