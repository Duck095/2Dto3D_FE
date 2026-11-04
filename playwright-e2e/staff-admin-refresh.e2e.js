import { expect, test } from '@playwright/test';

const STAFF_API_PATH = '/api/admin/staff';
const IDENTITY_API_PATH = '/api/v1/me';

function isApiRequest(request, pathname) {
  const url = new URL(request.url());
  return url.pathname === pathname && request.method() === 'GET';
}

function sanitizeDiagnostic(value) {
  return String(value)
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]')
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/(password|authorization|access[_-]?token|secret)("?\s*[:=]\s*"?)[^"\s,;}]+/gi, '$1$2[REDACTED]');
}

async function waitForStaffRequestsToSettle(page, activity) {
  const quietPeriodMs = 1_000;
  const timeoutMs = 8_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (activity.lastStaffRequestAt && Date.now() - activity.lastStaffRequestAt >= quietPeriodMs) return;
    await page.waitForTimeout(100);
  }

  throw new Error('GET /api/admin/staff did not become quiet after the list loaded.');
}

async function unique(locator) {
  await expect(locator).toHaveCount(1);
  return locator;
}

async function clickUnique(locator) {
  await (await unique(locator)).click();
}

async function fillUnique(locator, value) {
  await (await unique(locator)).fill(value);
}

async function expectUniqueVisible(locator) {
  const singleMatch = await unique(locator);
  await expect(singleMatch).toBeVisible();
}

test('ADMIN login and staff directory survive one page reload', async ({ page }) => {
  const adminEmail = process.env.QA_ADMIN_EMAIL;
  const adminPassword = process.env.QA_ADMIN_PASSWORD;
  const employeeNumber = process.env.QA_EMPLOYEE_NUMBER;
  if (!adminEmail || !adminPassword || !employeeNumber) {
    throw new Error('Required QA E2E environment is missing.');
  }

  const activity = { lastStaffRequestAt: 0, staffResponses: [], identityResponses: [] };
  const consoleErrors = [];
  const pageErrors = [];
  const failedSameOriginRequests = [];
  const origin = new URL('http://127.0.0.1:3000').origin;

  page.on('request', request => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === STAFF_API_PATH) {
      activity.lastStaffRequestAt = Date.now();
    }
  });
  page.on('response', response => {
    const request = response.request();
    const url = new URL(response.url());
    if (request.method() === 'GET' && url.pathname === STAFF_API_PATH) {
      activity.staffResponses.push(response.status());
    }
    if (request.method() === 'GET' && url.pathname === IDENTITY_API_PATH) {
      activity.identityResponses.push(response.status());
    }
  });
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(sanitizeDiagnostic(message.text()));
  });
  page.on('pageerror', error => pageErrors.push(sanitizeDiagnostic(error.message)));
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    const errorText = request.failure()?.errorText || 'request failed';
    const isExpectedCancellation = /ERR_ABORTED|aborted/i.test(errorText);
    if (url.origin === origin && !isExpectedCancellation) {
      failedSameOriginRequests.push(`${request.method()} ${url.pathname}: ${sanitizeDiagnostic(errorText)}`);
    }
  });

  await page.goto('/login');
  const loginResponsePromise = page.waitForResponse(response => {
    const request = response.request();
    return request.method() === 'POST' && new URL(response.url()).pathname === '/api/auth/login';
  });
  const identityResponsePromise = page.waitForResponse(response => isApiRequest(response.request(), IDENTITY_API_PATH));

  await page.getByLabel('Địa chỉ email').fill(adminEmail);
  await page.locator('input#auth-password').fill(adminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  const [loginResponse, identityResponse] = await Promise.all([
    loginResponsePromise,
    identityResponsePromise,
  ]);
  expect(loginResponse.status()).toBe(200);
  const loginData = await loginResponse.json();
  expect(loginData.role).toBe('ADMIN');
  expect(identityResponse.status()).toBe(200);
  await page.waitForURL(url => url.pathname.startsWith('/admin'));

  const firstStaffResponsePromise = page.waitForResponse(response => isApiRequest(response.request(), STAFF_API_PATH));
  await page.goto('/admin/staff');
  const firstStaffResponse = await firstStaffResponsePromise;
  expect(firstStaffResponse.status()).toBe(200);
  const firstPage = await firstStaffResponse.json();
  expect(firstPage.content.some(profile => profile.employeeNumber === employeeNumber)).toBe(true);
  await expect(page.getByText(employeeNumber, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nhân viên' })).toBeVisible();
  await waitForStaffRequestsToSettle(page, activity);

  const identityAfterReloadPromise = page.waitForResponse(response => isApiRequest(response.request(), IDENTITY_API_PATH));
  const staffAfterReloadPromise = page.waitForResponse(response => isApiRequest(response.request(), STAFF_API_PATH));
  await page.reload();
  const [identityAfterReload, staffAfterReload] = await Promise.all([
    identityAfterReloadPromise,
    staffAfterReloadPromise,
  ]);
  expect(identityAfterReload.status()).toBe(200);
  expect(staffAfterReload.status()).toBe(200);
  const reloadedPage = await staffAfterReload.json();
  expect(reloadedPage.content.some(profile => profile.employeeNumber === employeeNumber)).toBe(true);
  await expect(page).toHaveURL(/\/admin\/staff$/);
  await expect(page.getByText(employeeNumber, { exact: true })).toBeVisible();
  await waitForStaffRequestsToSettle(page, activity);

  expect(consoleErrors, 'browser console errors (sensitive values redacted)').toEqual([]);
  expect(pageErrors, 'uncaught browser errors (sensitive values redacted)').toEqual([]);
  expect(failedSameOriginRequests, 'failed same-origin requests (sensitive values redacted)').toEqual([]);
  expect(activity.staffResponses.every(status => status === 200)).toBe(true);
  expect(activity.identityResponses.every(status => status === 200)).toBe(true);
});

test('ADMIN creates, searches, edits, activates, and reloads a staff profile', async ({ page }) => {
  const adminEmail = process.env.QA_ADMIN_EMAIL;
  const adminPassword = process.env.QA_ADMIN_PASSWORD;
  const createStaffUserId = process.env.QA_CREATE_STAFF_USER_ID;
  const employeeNumber = `${process.env.QA_EMPLOYEE_NUMBER}-UI`;
  if (!adminEmail || !adminPassword || !createStaffUserId || !process.env.QA_EMPLOYEE_NUMBER) {
    throw new Error('Required QA E2E environment is missing.');
  }

  await page.goto('/login');
  const loginResponsePromise = page.waitForResponse(response => {
    const request = response.request();
    return request.method() === 'POST' && new URL(response.url()).pathname === '/api/auth/login';
  });
  const identityResponsePromise = page.waitForResponse(response => isApiRequest(response.request(), IDENTITY_API_PATH));
  await fillUnique(page.getByLabel('Địa chỉ email'), adminEmail);
  await fillUnique(page.locator('input#auth-password'), adminPassword);
  await clickUnique(page.getByRole('button', { name: 'Đăng nhập' }));
  const [loginResponse, identityResponse] = await Promise.all([loginResponsePromise, identityResponsePromise]);
  expect(loginResponse.status()).toBe(200);
  expect(identityResponse.status()).toBe(200);
  expect((await loginResponse.json()).role).toBe('ADMIN');
  await page.waitForURL(url => url.pathname.startsWith('/admin'));

  const initialListPromise = page.waitForResponse(response => isApiRequest(response.request(), STAFF_API_PATH));
  await page.goto('/admin/staff');
  expect((await initialListPromise).status()).toBe(200);
  await expectUniqueVisible(page.getByRole('heading', { name: 'Nhân viên' }));

  await clickUnique(page.getByRole('button', { name: 'Tạo hồ sơ', exact: true }));
  const createForm = await unique(page.locator('form.admin-staff-form'));
  await fillUnique(createForm.getByLabel('ID tài khoản hiện có'), createStaffUserId);
  await fillUnique(createForm.getByLabel('Mã nhân viên'), employeeNumber);
  await fillUnique(createForm.getByLabel('Phòng ban'), 'E2E UI Initial Department');
  await fillUnique(createForm.getByLabel('Chức danh'), 'E2E UI Initial Title');
  await fillUnique(createForm.getByLabel('Ngày gia nhập'), '2020-01-15');

  const createResponsePromise = page.waitForResponse(response => {
    const request = response.request();
    return request.method() === 'POST' && new URL(response.url()).pathname === STAFF_API_PATH;
  });
  await clickUnique(createForm.getByRole('button', { name: 'Tạo hồ sơ', exact: true }));
  const createResponse = await createResponsePromise;
  expect(createResponse.status()).toBe(201);
  const createdProfile = await createResponse.json();
  expect(createdProfile.employeeNumber).toBe(employeeNumber);
  expect(createdProfile.status).toBe('PENDING');
  expect(createdProfile.userId).toBe(Number(createStaffUserId));

  await expectUniqueVisible(page.getByRole('status').filter({ hasText: 'Đã tạo hồ sơ nhân sự' }));
  await fillUnique(page.getByLabel('Tìm kiếm'), employeeNumber);
  const searchResponsePromise = page.waitForResponse(response => {
    const request = response.request();
    const url = new URL(response.url());
    return request.method() === 'GET'
      && url.pathname === STAFF_API_PATH
      && url.searchParams.get('query') === employeeNumber;
  });
  await clickUnique(page.getByRole('button', { name: 'Lọc danh sách' }));
  const searchResponse = await searchResponsePromise;
  expect(searchResponse.status()).toBe(200);
  const searchPage = await searchResponse.json();
  expect(searchPage.content.some(profile => profile.id === createdProfile.id)).toBe(true);
  await expectUniqueVisible(page.getByText(employeeNumber, { exact: true }));

  const detailResponsePromise = page.waitForResponse(response => {
    const request = response.request();
    return request.method() === 'GET'
      && new URL(response.url()).pathname === `${STAFF_API_PATH}/${createdProfile.id}`;
  });
  await clickUnique(page.getByRole('button', { name: 'Xem hồ sơ E2E QA Staff To Create' }));
  const detailResponse = await detailResponsePromise;
  expect(detailResponse.status()).toBe(200);
  const detailCard = await unique(page.locator('.admin-staff-detail-card'));
  await expectUniqueVisible(detailCard.getByRole('heading', { name: 'E2E QA Staff To Create' }));
  await clickUnique(detailCard.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
  const editForm = await unique(detailCard.locator('form.admin-staff-form'));
  await fillUnique(editForm.getByLabel('Phòng ban'), 'E2E UI Updated Department');
  await fillUnique(editForm.getByLabel('Chức danh'), 'E2E UI Updated Title');

  const updateResponsePromise = page.waitForResponse(response => {
    const request = response.request();
    return request.method() === 'PATCH'
      && new URL(response.url()).pathname === `${STAFF_API_PATH}/${createdProfile.id}`;
  });
  await clickUnique(editForm.getByRole('button', { name: 'Lưu hồ sơ' }));
  const updateResponse = await updateResponsePromise;
  expect(updateResponse.status()).toBe(200);
  const updatedProfile = await updateResponse.json();
  expect(updatedProfile.department).toBe('E2E UI Updated Department');
  expect(updatedProfile.jobTitle).toBe('E2E UI Updated Title');

  await clickUnique(detailCard.getByRole('button', { name: 'Đổi trạng thái' }));
  const statusForm = await unique(detailCard.locator('form.admin-staff-form'));
  await (await unique(statusForm.getByLabel('Trạng thái tiếp theo'))).selectOption('ACTIVE');
  const reason = 'E2E QA verified onboarding requirements.';
  await fillUnique(statusForm.getByLabel('Lý do thay đổi'), reason);
  const statusResponsePromise = page.waitForResponse(response => {
    const request = response.request();
    return request.method() === 'PATCH'
      && new URL(response.url()).pathname === `${STAFF_API_PATH}/${createdProfile.id}/status`;
  });
  await clickUnique(statusForm.getByRole('button', { name: 'Xác nhận đổi trạng thái' }));
  const statusResponse = await statusResponsePromise;
  expect(statusResponse.status()).toBe(200);
  expect(statusResponse.request().postDataJSON().reason).toBe(reason);
  const activeProfile = await statusResponse.json();
  expect(activeProfile.status).toBe('ACTIVE');

  const identityAfterReloadPromise = page.waitForResponse(response => isApiRequest(response.request(), IDENTITY_API_PATH));
  const listAfterReloadPromise = page.waitForResponse(response => isApiRequest(response.request(), STAFF_API_PATH));
  await page.reload();
  const [identityAfterReload, listAfterReload] = await Promise.all([identityAfterReloadPromise, listAfterReloadPromise]);
  expect(identityAfterReload.status()).toBe(200);
  expect(listAfterReload.status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/staff$/);

  await fillUnique(page.getByLabel('Tìm kiếm'), employeeNumber);
  const finalSearchResponsePromise = page.waitForResponse(response => {
    const request = response.request();
    const url = new URL(response.url());
    return request.method() === 'GET'
      && url.pathname === STAFF_API_PATH
      && url.searchParams.get('query') === employeeNumber;
  });
  await clickUnique(page.getByRole('button', { name: 'Lọc danh sách' }));
  const finalSearchResponse = await finalSearchResponsePromise;
  expect(finalSearchResponse.status()).toBe(200);
  const finalSearchPage = await finalSearchResponse.json();
  const persistedProfile = finalSearchPage.content.find(profile => profile.id === createdProfile.id);
  expect(persistedProfile).toMatchObject({
    employeeNumber,
    department: 'E2E UI Updated Department',
    jobTitle: 'E2E UI Updated Title',
    status: 'ACTIVE',
  });
  await expectUniqueVisible(page.getByText(employeeNumber, { exact: true }));
  const persistedDetailPromise = page.waitForResponse(response => {
    const request = response.request();
    return request.method() === 'GET'
      && new URL(response.url()).pathname === `${STAFF_API_PATH}/${createdProfile.id}`;
  });
  await clickUnique(page.getByRole('button', { name: 'Xem hồ sơ E2E QA Staff To Create' }));
  const persistedDetail = await persistedDetailPromise;
  expect(persistedDetail.status()).toBe(200);
  const persistedProfileDetail = await persistedDetail.json();
  expect(persistedProfileDetail).toMatchObject({
    employeeNumber,
    department: 'E2E UI Updated Department',
    jobTitle: 'E2E UI Updated Title',
    status: 'ACTIVE',
  });
  await expectUniqueVisible(detailCard.getByText('E2E UI Updated Department', { exact: true }));
  await expectUniqueVisible(detailCard.getByText('E2E UI Updated Title', { exact: true }));
  await expectUniqueVisible(detailCard.getByText('Đang hoạt động', { exact: true }));
});

test('USER cannot access staff administration and Staff API enforces authentication', async ({ page, request }) => {
  const userEmail = process.env.QA_USER_EMAIL;
  const userPassword = process.env.QA_USER_PASSWORD;
  if (!userEmail || !userPassword) throw new Error('Required QA E2E environment is missing.');

  await page.goto('/login');
  const loginResponsePromise = page.waitForResponse(response => {
    const request = response.request();
    return request.method() === 'POST' && new URL(response.url()).pathname === '/api/auth/login';
  });
  const identityResponsePromise = page.waitForResponse(response => isApiRequest(response.request(), IDENTITY_API_PATH));
  await fillUnique(page.getByLabel('Địa chỉ email'), userEmail);
  await fillUnique(page.locator('input#auth-password'), userPassword);
  await clickUnique(page.getByRole('button', { name: 'Đăng nhập' }));
  const [loginResponse, identityResponse] = await Promise.all([loginResponsePromise, identityResponsePromise]);
  expect(loginResponse.status()).toBe(200);
  expect(identityResponse.status()).toBe(200);
  const loginData = await loginResponse.json();
  expect(loginData.role).toBe('USER');
  expect(typeof loginData.token).toBe('string');
  await page.waitForURL(url => url.pathname === '/');

  const browserStaffListResponses = [];
  page.on('response', response => {
    if (isApiRequest(response.request(), STAFF_API_PATH)) browserStaffListResponses.push(response.status());
  });
  await page.goto('/admin/staff');
  await expectUniqueVisible(page.getByRole('heading', { name: 'Bạn không có quyền truy cập' }));
  await expect(page).toHaveURL(/\/admin\/staff$/);
  expect(browserStaffListResponses).toEqual([]);

  const authenticatedStaffResponse = await request.get('http://127.0.0.1:3000/api/admin/staff', {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  expect(authenticatedStaffResponse.status()).toBe(403);

  const unauthenticatedStaffResponse = await request.get('http://127.0.0.1:3000/api/admin/staff');
  expect(unauthenticatedStaffResponse.status()).toBe(401);
});
