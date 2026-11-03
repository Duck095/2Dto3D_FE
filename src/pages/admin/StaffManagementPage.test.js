import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import postcss from 'postcss';

const page = await readFile(new URL('./StaffManagementPage.jsx', import.meta.url), 'utf8').catch(error => {
  if (error.code === 'ENOENT') return '';
  throw error;
});
const css = await readFile(new URL('./staff-management.css', import.meta.url), 'utf8').catch(error => {
  if (error.code === 'ENOENT') return '';
  throw error;
});
const routes = await readFile(new URL('../../routes/AppRoutes.jsx', import.meta.url), 'utf8');
const navigation = await readFile(new URL('../../config/adminNavigation.js', import.meta.url), 'utf8');

test('Staff page loads real backend records and exposes loading, empty, retry and error states', () => {
  assert.match(page, /listStaff\(/);
  assert.match(page, /getStaffCollectionState\(/);
  assert.match(page, /<SkeletonLine/);
  assert.match(page, /<EmptyState/);
  assert.match(page, /<ErrorState[\s\S]*?onRetry/);
  assert.match(page, /AbortController/);
  assert.ok((page.match(/if \(controller\.signal\.aborted\) return;/g) || []).length >= 2);
  assert.match(page, /totalElements: null/);
  assert.match(page, /listState\.totalElements == null/);
});

test('staff list failures stay in an error state until the user explicitly retries', () => {
  const listEffect = page.match(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[params, pageIndex, pageSize, reloadList\]\);/)?.[1] || '';
  assert.match(listEffect, /\.catch\(error =>/);
  assert.match(listEffect, /loading: false, error/);
  assert.doesNotMatch(listEffect, /setReloadList|setInterval|setTimeout/);
  assert.match(page, /collectionState === 'error'[\s\S]*?onRetry=\{\(\) => setReloadList/);
});

test('Staff page supports server search, status and department filters, and response pagination', () => {
  assert.match(page, /buildStaffListParams\(/);
  assert.match(page, /name="query"/);
  assert.match(page, /name="status"/);
  assert.match(page, /name="department"/);
  assert.match(page, /totalPages/);
  assert.match(page, /totalElements/);
  assert.match(page, /setPageIndex\(/);
});

test('Staff UI offers real detail, create, editable profile fields and reasoned status changes', () => {
  assert.match(page, /getStaff\(/);
  assert.match(page, /createStaff\(/);
  assert.match(page, /updateStaff\(/);
  assert.match(page, /changeStaffStatus\(/);
  assert.match(page, /validateAndBuildCreateStaffPayload\(/);
  assert.match(page, /validateAndBuildStaffUpdatePayload\(/);
  assert.match(page, /validateAndBuildStatusPayload\(/);
  assert.match(page, /name="userId"[\s\S]*?name="employeeNumber"/);
  assert.match(page, /name="department"[\s\S]*?name="jobTitle"[\s\S]*?name="joinedAt"/);
  assert.match(page, /name="reason"/);
});

test('Staff page reuses Admin foundation and reports mutation feedback accessibly', () => {
  for (const component of ['AdminTable', 'AdminField', 'StatusBadge', 'PopCard']) {
    assert.match(page, new RegExp(`<${component}\\b`));
  }
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /role="alert"/);
  assert.match(page, /getStaffApiErrorMessage\(/);
});

test('Staff mutations use a request identity guard and synchronous duplicate-submit protection', () => {
  assert.match(page, /createStaffMutationRunner/);
  assert.match(page, /mutationRunnerRef\.current\.invalidate\(\)/);
  assert.match(page, /onSuccess:/);
  assert.match(page, /onError:/);
  assert.match(page, /onSettled:/);
});

test('Staff route remains a child of the guarded Admin shell and sidebar destination is enabled', () => {
  assert.match(routes, /path: '\/admin',[\s\S]*?requiredContext="ADMIN"[\s\S]*?path: 'staff'/);
  assert.match(navigation, /id: 'staff', label: 'Nhân sự', to: '\/admin\/staff', available: true/);
});

test('Staff styles stay inside the Admin namespace and define compact responsive layouts', () => {
  const root = postcss.parse(css);
  const selectors = [];
  root.walkRules(rule => selectors.push(...postcss.list.comma(rule.selector)));
  assert.ok(selectors.length > 0);
  for (const selector of selectors) assert.match(selector.trim(), /^\.admin-workspace(?=$|\s|[.:#[>+~])/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
});
