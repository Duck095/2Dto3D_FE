import { expect, test } from '@playwright/test';

test('disabled AI Studio is unavailable and does not call AI or commerce APIs', async ({ page }) => {
  const forbiddenRequests = [];
  page.on('request', request => {
    if (/\/api\/(?:.*(?:ai-models|ai-studio|generation|cart|checkout|orders|payments|quotes?))(?:\/|\?|$)/i.test(request.url())) {
      forbiddenRequests.push(request.url());
    }
  });

  await page.goto('/studio');
  await expect(page.getByRole('heading', { name: 'Trang không tồn tại' })).toBeVisible();
  expect(forbiddenRequests).toEqual([]);
});

test('enabled AI Studio mounts its page and waits for explicit user action before calling the Backend', async ({ page }) => {
  const forbiddenRequests = [];
  const pageErrors = [];
  page.on('request', request => {
    if (/\/api\/(?:.*(?:ai-models|ai-studio|generation|cart|checkout|orders|payments|quotes?))(?:\/|\?|$)/i.test(request.url())) {
      forbiddenRequests.push(request.url());
    }
  });
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/studio');
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hôm nay bạn muốn tạo gì bằng 3D?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo mô hình 3D' })).toBeVisible();
  expect(forbiddenRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
