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
