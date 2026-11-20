import { expect, test } from '@playwright/test';

async function signInAndOpenStudio(page) {
  const email = process.env.AI_E2E_EMAIL;
  const password = process.env.AI_E2E_PASSWORD;
  expect(email, 'TEST_ONLY customer email must be supplied by the isolated Backend test').toBeTruthy();
  expect(password, 'TEST_ONLY customer password must be supplied by the isolated Backend test').toBeTruthy();

  await page.goto('/login');
  await page.getByLabel('Địa chỉ email').fill(email);
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(password);
  const loginResponsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/login');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.status(), `Live Backend login response: ${await loginResponse.text()}`).toBe(200);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('morphia_access_token'))).toBeTruthy();
  await page.goto('/studio?mode=text');
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
}

async function submitTextGeneration(page, mobile, apiResponses) {
  if (mobile) {
    await expect(page.locator('.ai-studio-page--compact')).toBeVisible();
    await page.getByRole('button', { name: 'Mở bảng ý tưởng' }).click();
  }
  await page.getByRole('button', { name: 'Móc khóa' }).click();
  const styleSelect = page.getByRole('combobox', { name: 'Phong cách theo sản phẩm' });
  await styleSelect.selectOption('chibi');
  await expect(styleSelect).toHaveValue('chibi');
  await page.getByRole('textbox', { name: /Describe your model/ }).fill('TEST_ONLY browser integration triangle lamp');
  await page.getByRole('button', { name: 'Generate Model' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Mô hình đã được tạo và lưu trên Backend.' }),
    `Live API responses: ${JSON.stringify(apiResponses)}`)
    .toBeVisible({ timeout: 45_000 });
}

for (const scenario of [
  { name: 'desktop', viewport: { width: 1440, height: 1000 }, mobile: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, mobile: true },
]) {
  test(`${scenario.name} browser authenticates and generates through the live TEST_ONLY Backend`, async ({ page }) => {
    const pageErrors = [];
    const apiResponses = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith('/api/')) return;
      const entry = { method: response.request().method(), path: url.pathname, status: response.status() };
      apiResponses.push(entry);
      if (url.pathname.startsWith('/api/ai-studio/generations')
          && response.headers()['content-type']?.includes('application/json')) {
        void response.json().then(body => { entry.body = body; }).catch(() => {});
      }
    });
    await page.setViewportSize(scenario.viewport);
    await signInAndOpenStudio(page);
    await submitTextGeneration(page, scenario.mobile, apiResponses);

    await expect.poll(() => apiResponses.find(response => response.method === 'POST'
      && response.path === '/api/ai-studio/generations' && response.status === 202)?.body?.id).toBeTruthy();
    const accepted = apiResponses.find(response => response.method === 'POST'
      && response.path === '/api/ai-studio/generations' && response.status === 202);
    expect(accepted?.body?.status).toBe('PENDING');
    expect(accepted?.body?.id).toBeTruthy();
    expect(apiResponses.some(response => response.path === '/api/v1/me' && response.status === 200)).toBe(true);
    expect(apiResponses.some(response => response.path === `/api/ai-studio/generations/${accepted.body.id}`
      && response.status === 200)).toBe(true);
    const result = await page.evaluate(async id => {
      const token = localStorage.getItem('morphia_access_token');
      const response = await fetch(`/api/ai-studio/generations/${encodeURIComponent(id)}/result`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const bytes = await response.arrayBuffer();
      return {
        status: response.status,
        contentType: response.headers.get('content-type'),
        cacheControl: response.headers.get('cache-control'),
        byteLength: bytes.byteLength,
      };
    }, accepted.body.id);
    expect(result.status).toBe(200);
    expect(result.contentType).toContain('model/gltf-binary');
    expect(result.cacheControl).toContain('no-store');
    expect(result.byteLength).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
    if (scenario.mobile) await expect(page.locator('.ai-studio-page--compact')).toBeVisible();
    else await expect(page.locator('.ai-studio-page--compact')).toHaveCount(0);
  });
}
