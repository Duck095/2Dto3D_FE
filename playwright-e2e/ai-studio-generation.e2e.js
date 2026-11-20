import { expect, test } from '@playwright/test';

const jobId = '123e4567-e89b-42d3-a456-426614174000';

function glbFixture() {
  const json = Buffer.from(JSON.stringify({
    asset: { version: '2.0', generator: 'TEST_ONLY browser fixture' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: 44 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
  }), 'utf8');
  const jsonLength = (json.length + 3) & ~3;
  const binary = Buffer.alloc(44);
  const positions = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, 0.5];
  positions.forEach((value, index) => binary.writeFloatLE(value, index * 4));
  [0, 1, 2].forEach((value, index) => binary.writeUInt16LE(value, 36 + index * 2));
  const output = Buffer.alloc(12 + 8 + jsonLength + 8 + binary.length);
  output.write('glTF', 0, 'ascii');
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonLength, 12);
  output.writeUInt32LE(0x4E4F534A, 16);
  json.copy(output, 20);
  output.fill(0x20, 20 + json.length, 20 + jsonLength);
  const binHeader = 20 + jsonLength;
  output.writeUInt32LE(binary.length, binHeader);
  output.writeUInt32LE(0x004E4942, binHeader + 4);
  binary.copy(output, binHeader + 8);
  return output;
}

async function installTestOnlySession(page, userId = 'test-user-a') {
  await page.addInitScript(id => {
    const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.TEST_ONLY`;
    localStorage.setItem('morphia_access_token', token);
    localStorage.setItem('morphia_user', JSON.stringify({ id, email: `${id}@example.invalid`, token }));
  }, userId);
}

async function installTestOnlyApi(page, { failProvider = false } = {}) {
  const requestLog = [];
  let statusReads = 0;
  await page.route('**/api/v1/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 41, name: 'TEST_ONLY user', email: 'test@example.invalid', role: 'USER', contexts: ['CUSTOMER'] }),
  }));
  await page.route('**/api/ai-studio/generations/history**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0 }),
  }));
  await page.route('**/api/ai-studio/generations', async route => {
    const request = route.request();
    const url = new URL(request.url());
    requestLog.push({ method: request.method(), pathname: url.pathname, idempotencyKey: request.headers()['idempotency-key'] });
    if (request.method() !== 'POST') {
      await route.fulfill({ status: 405 });
    } else if (failProvider) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({
        code: 'AI_PROVIDER_NOT_CONFIGURED', message: 'Backend chưa được cấu hình nhà cung cấp AI.', accepted: false,
      }) });
    } else {
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({
        id: jobId, status: 'PENDING', createdAt: new Date().toISOString(),
      }) });
    }
  });
  await page.route('**/api/ai-studio/generations/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    requestLog.push({ method: request.method(), pathname: url.pathname, idempotencyKey: request.headers()['idempotency-key'] });
    if (url.pathname.endsWith('/result')) {
      await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: glbFixture() });
      return;
    }
    if (request.method() === 'GET' && url.pathname === `/api/ai-studio/generations/${jobId}`) {
      statusReads += 1;
      if (statusReads === 1) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: jobId, status: 'PROCESSING' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          id: jobId, status: 'COMPLETED', title: 'TEST_ONLY triangle', modelUrl: `/api/ai-studio/generations/${jobId}/result`,
        }) });
      }
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY_NOT_FOUND' }) });
  });
  return requestLog;
}

async function prepareTextGeneration(page, mobile = false) {
  await page.goto('/studio?mode=text');
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  if (mobile) {
    await expect(page.locator('.ai-studio-page--compact')).toBeVisible();
    await page.getByRole('button', { name: 'Mở bảng ý tưởng' }).click();
  }
  await page.getByRole('button', { name: 'Móc khóa' }).click();
  const styleSelect = page.getByRole('combobox', { name: 'Phong cách theo sản phẩm' });
  await styleSelect.selectOption('chibi');
  await expect(styleSelect).toHaveValue('chibi');
  await page.getByRole('textbox', { name: /Describe your model/ }).fill('TEST_ONLY small triangle lamp');
}

test('desktop TEST_ONLY job flows from accepted to completed and loads its protected GLB result', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installTestOnlySession(page);
  const requests = await installTestOnlyApi(page);
  await prepareTextGeneration(page);

  await page.getByRole('button', { name: 'Generate Model' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Mô hình đã được tạo và lưu trên Backend.' })).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => requests.some(request => request.pathname.endsWith(`/generations/${jobId}/result`))).toBe(true);
  const generatedModel = page.getByRole('button', { name: 'TEST_ONLY triangle' });
  await expect(generatedModel).toBeVisible();
  await generatedModel.click();
  await expect(page.locator('canvas')).toBeVisible();
  expect(requests.filter(request => request.method === 'POST')).toHaveLength(1);
  expect(requests.find(request => request.method === 'POST')?.idempotencyKey).toBeTruthy();
  expect(pageErrors).toEqual([]);
});

test('mobile TEST_ONLY provider rejection stays explicit and never exposes a model', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTestOnlySession(page);
  await installTestOnlyApi(page, { failProvider: true });
  await prepareTextGeneration(page, true);

  await page.getByRole('button', { name: 'Generate Model' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Backend chưa được cấu hình nhà cung cấp AI.' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('.ai-studio-page--compact')).toBeVisible();
});
