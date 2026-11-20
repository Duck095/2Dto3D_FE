import { expect, test } from '@playwright/test';

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aQAAAABJRU5ErkJggg==';

async function openStudio(page, viewport) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.TEST_ONLY`;
    localStorage.setItem('morphia_access_token', token);
    localStorage.setItem('morphia_user', JSON.stringify({
      id: 'fe01-user', email: 'fe01@example.invalid', token,
    }));
  });
  await page.route('**/api/v1/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'fe01-user', name: 'TEST_ONLY user', email: 'fe01@example.invalid', role: 'USER', contexts: ['CUSTOMER'] }),
  }));
  await page.route('**/api/ai-studio/generations/history**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0 }),
  }));
  await page.goto('/studio');
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
}

async function uploadImage(page) {
  await page.getByRole('tab', { name: 'Image to 3D' }).click();
  await page.getByLabel('Choose a PNG, JPEG or WebP reference image').setInputFiles({
    name: 'reference.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1PX, 'base64'),
  });
  await expect(page.getByRole('button', { name: 'Choose another image' })).toBeVisible();
  await page.getByLabel('Mô tả bổ sung (không bắt buộc)').fill('Keep this description while replacing the image.');
  await page.getByLabel('Choose a PNG, JPEG or WebP reference image').setInputFiles({
    name: 'replacement.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1PX, 'base64'),
  });
  await expect(page.getByLabel('Mô tả bổ sung (không bắt buộc)')).toHaveValue('Keep this description while replacing the image.');
}

test('FE-01 desktop image ordering, generation settings and sidebar persistence', async ({ page }) => {
  const postRequests = [];
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/ai-studio\/generations(?:\?|$)/.test(request.url())) postRequests.push(request.url());
  });
  await openStudio(page, { width: 1440, height: 1000 });
  await uploadImage(page);
  await expect(page.locator('.ai-studio__history-panel')).toBeVisible();

  const uploadY = await page.locator('.ai-studio__upload-zone').evaluate(node => node.getBoundingClientRect().top);
  const descriptionY = await page.getByLabel('Mô tả bổ sung (không bắt buộc)').evaluate(node => node.getBoundingClientRect().top);
  expect(uploadY).toBeLessThan(descriptionY);
  await expect(page.getByLabel('Mô tả bổ sung (không bắt buộc)')).toHaveAttribute('rows', '3');
  const description = page.getByLabel('Mô tả bổ sung (không bắt buộc)');
  const initialHeight = await description.evaluate(node => node.getBoundingClientRect().height);
  await description.fill('line of prompt\n'.repeat(40));
  const expandedTextarea = await description.evaluate(node => ({ height: node.getBoundingClientRect().height, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }));
  expect(expandedTextarea.height).toBeGreaterThan(initialHeight);
  expect(expandedTextarea.height).toBeLessThanOrEqual(200);
  expect(expandedTextarea.scrollHeight).toBeGreaterThan(expandedTextarea.clientHeight);
  await description.fill('Keep this description while replacing the image.');
  await page.getByRole('button', { name: 'Móc khóa' }).click();
  await expect(page.getByRole('heading', { name: 'Generation Settings' })).toBeVisible();
  await expect(page.getByText('QUALITY', { exact: true })).toHaveCount(0);
  for (const option of ['Standard', 'High', 'Draft']) await expect(page.getByRole('button', { name: option, exact: true })).toHaveCount(0);

  const separator = page.locator('.ai-studio__resize-handle');
  await expect(separator).toBeVisible();
  const beforeWidth = await page.locator('.ai-studio__sidebar').evaluate(node => node.getBoundingClientRect().width);
  const bounds = await separator.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 100, bounds.y + 100);
  await page.mouse.up();
  await expect.poll(() => page.locator('.ai-studio__sidebar').evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(beforeWidth + 60);

  const keyboardStart = Number(await separator.getAttribute('aria-valuenow'));
  await separator.focus();
  await separator.press('ArrowRight');
  await expect.poll(async () => Number(await separator.getAttribute('aria-valuenow'))).toBe(keyboardStart + 16);
  await separator.press('End');
  await separator.press('ArrowLeft');
  await separator.press('Home');
  await separator.press('ArrowRight');

  const expandedWidth = await page.locator('.ai-studio__sidebar').evaluate(node => node.getBoundingClientRect().width);
  await page.getByRole('button', { name: 'Thu gọn bảng ý tưởng' }).click();
  await expect(page.locator('.ai-studio__sidebar')).toHaveClass(/is-collapsed/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('2dto3d.ai-studio.sidebar-collapsed'))).toBe('true');
  await page.getByRole('button', { name: 'Mở bảng ý tưởng' }).click();
  await expect(page.getByLabel('Mô tả bổ sung (không bắt buộc)')).toHaveValue('Keep this description while replacing the image.');
  await expect(page.getByRole('button', { name: 'Choose another image' })).toBeVisible();
  await page.getByRole('button', { name: 'Thu gọn bảng ý tưởng' }).click();
  await page.reload();
  await expect(page.locator('.ai-studio__sidebar')).toHaveClass(/is-collapsed/);
  await page.getByRole('button', { name: 'Mở bảng ý tưởng' }).click();
  await expect.poll(() => page.locator('.ai-studio__sidebar').evaluate(node => node.getBoundingClientRect().width)).toBeCloseTo(expandedWidth, -1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(postRequests).toEqual([]);
});

test('FE-01 desktop sidebar and viewer geometry stay valid from 1024px through wide desktop', async ({ page }) => {
  await openStudio(page, { width: 1024, height: 1000 });
  const sidebar = page.locator('.ai-studio__sidebar');
  const viewer = page.locator('.ai-studio__preview-stage');
  const history = page.locator('.ai-studio__history-panel');
  const separator = page.locator('.ai-studio__resize-handle');

  for (const width of [1024, 1199, 1200, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(separator).toBeVisible();
    await expect(history).toBeVisible();
    await separator.focus();
    await separator.press('Home');
    const historyWidthBefore = await history.evaluate(node => node.getBoundingClientRect().width);
    const sidebarWidthBefore = await sidebar.evaluate(node => node.getBoundingClientRect().width);
    const viewerWidthBefore = await viewer.evaluate(node => node.getBoundingClientRect().width);
    const handleBox = await separator.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 20, handleBox.y + 100);
    await page.mouse.up();

    const sidebarWidthAfterPointer = await sidebar.evaluate(node => node.getBoundingClientRect().width);
    const viewerWidthAfterPointer = await viewer.evaluate(node => node.getBoundingClientRect().width);
    expect(sidebarWidthAfterPointer).toBeGreaterThan(sidebarWidthBefore + 8);
    expect(viewerWidthAfterPointer).toBeLessThan(viewerWidthBefore);
    expect(viewerWidthAfterPointer).toBeGreaterThanOrEqual(360);
    expect(await history.evaluate(node => node.getBoundingClientRect().width)).toBe(historyWidthBefore);

    await separator.focus();
    const beforeArrowLeft = await sidebar.evaluate(node => node.getBoundingClientRect().width);
    await separator.press('ArrowLeft');
    await expect.poll(() => sidebar.evaluate(node => node.getBoundingClientRect().width)).toBeLessThan(beforeArrowLeft);
    const afterArrowLeft = await sidebar.evaluate(node => node.getBoundingClientRect().width);
    await separator.press('ArrowRight');
    await expect.poll(() => sidebar.evaluate(node => node.getBoundingClientRect().width)).toBeCloseTo(afterArrowLeft + 16, 0);
    const beforeHome = await sidebar.evaluate(node => node.getBoundingClientRect().width);
    await separator.press('Home');
    const minimumWidth = Number(await separator.getAttribute('aria-valuemin'));
    await expect.poll(() => sidebar.evaluate(node => node.getBoundingClientRect().width)).toBeCloseTo(minimumWidth, 0);
    await separator.press('End');
    const maximumWidth = Number(await separator.getAttribute('aria-valuemax'));
    await expect.poll(() => sidebar.evaluate(node => node.getBoundingClientRect().width)).toBeCloseTo(maximumWidth, 0);
    expect(await viewer.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThanOrEqual(360);
    expect(await history.evaluate(node => node.getBoundingClientRect().width)).toBe(historyWidthBefore);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(beforeHome).toBeGreaterThan(minimumWidth);
  }
});

test('FE-01 mobile drawer retains image input and other input modes fit the viewport', async ({ page }) => {
  await openStudio(page, { width: 390, height: 844 });
  await page.getByRole('button', { name: 'Mở bảng ý tưởng' }).click();
  await uploadImage(page);
  await expect(page.locator('.ai-studio-page--compact')).toBeVisible();
  await page.locator('.ai-studio__mobile-close').click();
  await expect(page.locator('.ai-studio__sidebar')).not.toHaveClass(/is-mobile-open/);
  await page.getByRole('button', { name: 'Mở bảng ý tưởng' }).click();
  await expect(page.getByLabel('Mô tả bổ sung (không bắt buộc)')).toHaveValue('Keep this description while replacing the image.');
  await page.getByRole('tab', { name: 'Text to 3D' }).click();
  await expect(page.getByRole('textbox', { name: /Describe your model/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Nhiều góc ảnh' }).click();
  await expect(page.getByText(/Tải lên từ 2 đến 8 ảnh/)).toBeVisible();
  await page.locator('.ai-studio__mobile-close').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
