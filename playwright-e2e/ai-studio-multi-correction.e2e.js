import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';

async function installSession(page, holdDigests = false) {
  await page.addInitScript(shouldHoldDigests => {
    const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.TEST_ONLY`;
    localStorage.setItem('morphia_access_token', token);
    localStorage.setItem('morphia_user', JSON.stringify({ id: 'multi-user', email: 'multi@example.invalid', token }));
    window.__createdObjectUrls = [];
    window.__revokedObjectUrls = [];
    const createObjectURL = URL.createObjectURL.bind(URL);
    const revokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      const url = createObjectURL(blob);
      window.__createdObjectUrls.push(url);
      return url;
    };
    URL.revokeObjectURL = url => {
      window.__revokedObjectUrls.push(url);
      revokeObjectURL(url);
    };
    if (shouldHoldDigests) {
      const digest = crypto.subtle.digest.bind(crypto.subtle);
      window.__digestResolvers = [];
      crypto.subtle.digest = (...args) => new Promise((resolve, reject) => {
        window.__digestResolvers.push(() => digest(...args).then(resolve, reject));
      });
      window.__releaseDigests = () => window.__digestResolvers.splice(0).forEach(release => release());
    }
  }, holdDigests);
}

async function mockApi(page, { onProjectPost, projects = {}, onInputContent } = {}) {
  const mutations = [];
  const calls = [];
  await page.route('**/*', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (!pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    calls.push({ method: request.method(), pathname });
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(request.url());
    if (pathname === '/api/v1/me') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'multi-user', name: 'TEST_ONLY', email: 'multi@example.invalid', role: 'USER', contexts: ['CUSTOMER'],
      }) });
      return;
    }
    if (pathname === '/api/ai-studio/generations/history') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0 }) });
      return;
    }
    if (pathname === '/api/ai-studio/projects' && request.method() === 'POST' && onProjectPost) {
      await onProjectPost(route);
      return;
    }
    if (pathname === '/api/ai-studio/projects/test-multi-project' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        projectId: 'test-multi-project', productType: 'figure', styleId: 'chibi-collectible',
        inputMode: 'multi', clientSlots: ['front', 'left'], viewHints: ['front', 'left'], status: 'DRAFT',
      }) });
      return;
    }
    const inputContentMatch = pathname.match(/^\/api\/ai-studio\/projects\/([^/]+)\/inputs\/([^/]+)\/content$/);
    if (inputContentMatch && request.method() === 'GET') {
      if (onInputContent) await onInputContent(route, decodeURIComponent(inputContentMatch[1]), decodeURIComponent(inputContentMatch[2]), request);
      else await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY_NOT_FOUND' }) });
      return;
    }
    const projectGetMatch = pathname.match(/^\/api\/ai-studio\/projects\/([^/]+)$/);
    if (projectGetMatch && request.method() === 'GET' && projects[decodeURIComponent(projectGetMatch[1])]) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projects[decodeURIComponent(projectGetMatch[1])]) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY_NOT_FOUND' }) });
  });
  Object.defineProperty(mutations, 'calls', { value: calls });
  return mutations;
}

test('MULTI reset clears product, style, files and preview without runtime errors or API mutations', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await installSession(page);
  const mutations = await mockApi(page);
  await page.goto('/studio?mode=text');
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  await page.getByRole('tab', { name: 'Nhiều góc ảnh' }).click();

  await page.getByRole('button', { name: 'Móc khóa' }).click();
  await page.getByRole('button', { name: 'Click' }).click();
  await page.getByRole('button', { name: 'Tượng 3D' }).click();
  await expect(page.getByLabel('Phong cách theo sản phẩm')).toBeVisible();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=', 'base64');
  await page.getByLabel('Choose Trước view').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Choose Trái view').setInputFiles({ name: 'left.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Đã chọn 2/8 ảnh.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trước view Trước' })).toHaveAttribute('aria-pressed', 'true');
  const changedPng = Buffer.concat([png, Buffer.from([1])]);
  await page.getByLabel('Choose Trước view').setInputFiles({ name: 'front-replaced.png', mimeType: 'image/png', buffer: changedPng });
  await expect(page.getByText('Đã chọn 2/8 ảnh.')).toBeVisible();
  const leftSlot = page.locator('.ai-studio__view-slot').filter({ has: page.getByLabel('Choose Trái view') });
  await leftSlot.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Đã chọn 1/8 ảnh.')).toBeVisible();
  await page.getByLabel('Choose Trái view').setInputFiles({ name: 'left-restored.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Đã chọn 2/8 ảnh.')).toBeVisible();

  await page.getByRole('button', { name: 'Phóng to ảnh', exact: true }).click();
  await expect(page.locator('.ai-studio__stage-content .ai-studio__image-preview img')).toHaveAttribute('style', /scale\(1\.15\)/);
  await page.getByRole('button', { name: 'Phóng to ảnh tham chiếu' }).click();
  await expect(page.getByRole('dialog', { name: 'Ảnh tham chiếu phóng to' })).toBeVisible();
  await page.getByRole('button', { name: 'Làm mới lựa chọn' }).evaluate(button => button.click());
  await expect(page.getByRole('dialog', { name: 'Ảnh tham chiếu phóng to' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tượng 3D' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Móc khóa' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('Phong cách theo sản phẩm')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Text to 3D' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByPlaceholder(/Describe the 3D model you want to create/)).toHaveValue('');
  await expect(page.locator('.ai-studio__stage-content .ai-studio__image-preview img')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Nhiều góc ảnh' }).click();
  await expect(page.getByText('Đã chọn 0/8 ảnh.')).toBeVisible();
  await expect(page.locator('.ai-studio__thumbnails img')).toHaveCount(0);
  const urlLifecycle = await page.evaluate(() => ({ created: window.__createdObjectUrls, revoked: window.__revokedObjectUrls }));
  expect(urlLifecycle.created).toHaveLength(4);
  expect(urlLifecycle.revoked).toEqual(expect.arrayContaining(urlLifecycle.created));
  expect(pageErrors).toEqual([]);
  expect(mutations).toEqual([]);

  await page.getByRole('button', { name: 'Móc khóa' }).click();
  await expect(page.getByRole('button', { name: 'Thường' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Phong cách theo sản phẩm')).toHaveValue('cute-mascot');
  await page.getByRole('tab', { name: 'Image to 3D' }).click();
  await page.getByLabel('Choose a PNG, JPEG or WebP reference image').setInputFiles({ name: 'after-reset.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.ai-studio__stage-content .ai-studio__image-preview img')).toHaveAttribute('style', /scale\(1\)/);
});

test('legacy FNV MULTI save stays blocked for manual reconciliation and sends no mutation', async ({ page }) => {
  await installSession(page);
  const mutations = await mockApi(page);
  await page.goto('/studio?mode=text');
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem('2dto3d.ai-studio.project-idempotency:account-144s0kh', JSON.stringify({
    key: 'legacy-key', fingerprint: '11iv3we-405',
  })));
  await page.getByRole('tab', { name: 'Nhiều góc ảnh' }).click();
  await page.getByRole('button', { name: 'Tượng 3D' }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=', 'base64');
  await page.getByLabel('Choose Trước view').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Choose Trái view').setInputFiles({ name: 'left.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Đã chọn 2/8 ảnh.')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Cần đối chiếu thủ công' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu dự án' })).toBeDisabled();
  expect(mutations).toEqual([]);
});

test('legacy multi-v2 and malformed idempotency records stay untouched and block MULTI POST', async ({ page }) => {
  await installSession(page);
  const mutations = await mockApi(page);
  await page.goto('/studio?mode=text');
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  const storageKey = '2dto3d.ai-studio.project-idempotency:account-144s0kh';
  for (const { serializedRecord, notice } of [
    {
      serializedRecord: JSON.stringify({ key: 'legacy-v2-key', fingerprint: 'multi-v2:{"data":{"idea":"legacy"}}' }),
      notice: 'có thể còn lưu ý tưởng thô trong sessionStorage',
    },
    { serializedRecord: '{broken', notice: 'Không thể xác minh bản ghi idempotency đã lưu' },
  ]) {
    await page.evaluate(([key, value]) => sessionStorage.setItem(key, value), [storageKey, serializedRecord]);
    await page.reload();
    await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
    await page.getByRole('tab', { name: 'Nhiều góc ảnh' }).click();
    await expect(page.getByRole('status').filter({ hasText: notice })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu dự án' })).toBeDisabled();
    expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBe(serializedRecord);
    expect(mutations).toEqual([]);
    await page.evaluate(key => sessionStorage.removeItem(key), storageKey);
  }
});

test('MULTI create retries with the same key, sends one multipart request at a time and reads the confirmed Project', async ({ page }) => {
  await installSession(page);
  let releaseFirstPost;
  let signalFirstPost;
  const firstPostStarted = new Promise(resolve => { signalFirstPost = resolve; });
  const postAttempts = [];
  const privateIdea = ['CHECKPOINT', 'IDEA', 'ONLY'].join(' ');
  const mutations = await mockApi(page, { onProjectPost: async route => {
    const request = route.request();
    const body = request.postData() || '';
    postAttempts.push({
      key: request.headers()['idempotency-key'],
      hasMultiContract: body.includes('"inputMode":"multi"') && body.includes('"clientSlots":["front","left"]'),
      imagePartCount: (body.match(/name="images"/g) || []).length,
    });
    if (postAttempts.length === 1) {
      signalFirstPost();
      await new Promise(resolve => { releaseFirstPost = resolve; });
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'TEST_ONLY uncertain result' }) });
      return;
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ projectId: 'test-multi-project' }) });
  } });
  await page.goto('/studio?mode=text');
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  await page.getByPlaceholder(/Describe the 3D model you want to create/).fill(privateIdea);
  await page.getByRole('tab', { name: 'Nhiều góc ảnh' }).click();
  await page.getByRole('button', { name: 'Tượng 3D' }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=', 'base64');
  await page.getByLabel('Choose Trước view').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Choose Trái view').setInputFiles({ name: 'left.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Đã chọn 2/8 ảnh.')).toBeVisible();

  await page.getByRole('button', { name: 'Lưu dự án' }).click();
  await firstPostStarted;
  const savingButton = page.getByRole('button', { name: 'Đang lưu dự án…' });
  await expect(savingButton).toBeDisabled();
  await savingButton.evaluate(button => button.click());
  expect(postAttempts).toHaveLength(1);
  expect(postAttempts[0].key).toBeTruthy();
  expect(postAttempts[0].hasMultiContract).toBe(true);
  expect(postAttempts[0].imagePartCount).toBe(2);
  const persistedRecordBeforeRefresh = await page.evaluate(() => sessionStorage.getItem('2dto3d.ai-studio.project-idempotency:account-144s0kh'));
  const parsedPersistedRecord = JSON.parse(persistedRecordBeforeRefresh);
  expect(parsedPersistedRecord.fingerprint).toMatch(/^multi-v3-sha256:[a-f0-9]{64}$/);
  expect(persistedRecordBeforeRefresh.includes(privateIdea)).toBe(false);
  const firstPostResponse = page.waitForResponse(response => {
    const request = response.request();
    return new URL(response.url()).pathname === '/api/ai-studio/projects' && request.method() === 'POST';
  });
  releaseFirstPost();
  expect((await firstPostResponse).status()).toBe(503);

  await expect(page.getByRole('button', { name: 'Gửi lại an toàn' })).toBeEnabled();
  await page.reload();
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  await page.getByPlaceholder(/Describe the 3D model you want to create/).fill(privateIdea);
  await page.getByRole('tab', { name: 'Nhiều góc ảnh' }).click();
  await page.getByRole('button', { name: 'Tượng 3D' }).click();
  await page.getByLabel('Choose Trước view').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Choose Trái view').setInputFiles({ name: 'left.png', mimeType: 'image/png', buffer: png });
  const retryButton = page.getByRole('button', { name: 'Gửi lại an toàn' });
  await expect(retryButton).toBeEnabled();
  await retryButton.click();
  await expect(page.getByText('Đã đọc dự án đã được Backend xác nhận.')).toBeVisible();
  await expect(page.getByText('test-multi-project', { exact: true })).toBeVisible();
  expect(postAttempts).toHaveLength(2);
  expect(postAttempts[1].key).toBe(postAttempts[0].key);
  expect(postAttempts[1].hasMultiContract).toBe(true);
  expect(mutations.filter(url => new URL(url).pathname === '/api/ai-studio/projects')).toHaveLength(2);
});

test('logout aborts an in-flight MULTI Project create and does not show its late response', async ({ page }) => {
  await installSession(page);
  let releasePost;
  let signalPostStarted;
  const postStarted = new Promise(resolve => { signalPostStarted = resolve; });
  const mutations = await mockApi(page, { onProjectPost: async route => {
    signalPostStarted();
    await new Promise(resolve => { releasePost = resolve; });
    try {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ projectId: 'late-project' }) });
    } catch { /* The browser may already have cancelled this request on logout. */ }
  } });
  await page.goto('/studio?mode=text');
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  await page.getByRole('tab', { name: 'Nhiều góc ảnh' }).click();
  await page.getByRole('button', { name: 'Tượng 3D' }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=', 'base64');
  await page.getByLabel('Choose Trước view').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Choose Trái view').setInputFiles({ name: 'left.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Đã chọn 2/8 ảnh.')).toBeVisible();
  await page.getByRole('button', { name: 'Lưu dự án' }).click();
  await postStarted;

  await page.getByRole('button', { name: 'Tài khoản' }).click();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
  releasePost();
  await page.goBack();
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  await page.getByRole('tab', { name: 'Nhiều góc ảnh' }).click();
  await expect(page.getByText('Đăng nhập để lưu hoặc đọc dự án riêng tư.')).toBeVisible();
  await expect(page.getByText('late-project', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Đã chọn 0/8 ảnh.')).toBeVisible();
  expect(mutations.filter(url => new URL(url).pathname === '/api/ai-studio/projects')).toHaveLength(1);
});

test('MULTI waits for all content hashes before saving and then releases the submit guard', async ({ page }) => {
  await installSession(page, true);
  const mutations = await mockApi(page, { onProjectPost: route => route.fulfill({
    status: 201, contentType: 'application/json', body: JSON.stringify({ projectId: 'test-multi-project' }),
  }) });
  await page.goto('/studio?mode=text');
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  await page.getByRole('tab', { name: 'Nhiều góc ảnh' }).click();
  await page.getByRole('button', { name: 'Tượng 3D' }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=', 'base64');
  await page.getByLabel('Choose Trước view').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Choose Trái view').setInputFiles({ name: 'left.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Đã chọn 2/8 ảnh. Đang chuẩn bị nội dung ảnh…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đang chuẩn bị ảnh…' })).toBeDisabled();
  expect(mutations).toEqual([]);

  await page.evaluate(() => window.__releaseDigests());
  const saveButton = page.getByRole('button', { name: 'Lưu dự án' });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect.poll(() => page.evaluate(() => window.__digestResolvers.length)).toBeGreaterThan(0);
  await page.evaluate(() => window.__releaseDigests());
  await expect(page.getByText('Đã đọc dự án đã được Backend xác nhận.')).toBeVisible();
  expect(mutations.filter(url => new URL(url).pathname === '/api/ai-studio/projects')).toHaveLength(1);
});

test('IMAGE and MULTI Project reads restore validated source files and reject invalid content', async ({ page }) => {
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aQAAAABJRU5ErkJggg==', 'base64');
  const sha256 = createHash('sha256').update(image).digest('hex');
  const imageInput = (inputId, overrides = {}) => ({ inputId, order: 0, mimeType: 'image/png', byteSize: image.length, sha256, clientSlot: null, viewHint: null, ...overrides });
  const multiInput = (inputId, order, clientSlot) => ({ inputId, order, mimeType: 'image/png', byteSize: image.length, sha256, clientSlot, viewHint: clientSlot });
  const project = (projectId, inputMode, inputs, overrides = {}) => ({
    projectId, productType: 'figure', styleId: 'chibi-collectible', inputMode, status: 'DRAFT', inputs, ...overrides,
  });
  const projects = {
    'restore-image': project('restore-image', 'image', [imageInput('image-input')]),
    'restore-multi': project('restore-multi', 'multi', [multiInput('left-input', 1, 'left'), multiInput('front-input', 0, 'front')], {
      clientSlots: ['front', 'left'], viewHints: ['front', 'left'],
    }),
    'restore-missing': project('restore-missing', 'image', [imageInput('missing-input')]),
    'restore-invalid-metadata': project('restore-invalid-metadata', 'image', [imageInput('invalid-input', { sha256: 'bad' })]),
    'restore-wrong-mime': project('restore-wrong-mime', 'image', [imageInput('wrong-mime-input')]),
    'restore-wrong-size': project('restore-wrong-size', 'image', [imageInput('wrong-size-input')]),
    'restore-wrong-sha': project('restore-wrong-sha', 'image', [imageInput('wrong-sha-input', { sha256: '0'.repeat(64) })]),
  };
  await installSession(page);
  const mutations = await mockApi(page, { projects, onInputContent: (route, projectId, inputId) => {
    if (projectId === 'restore-missing') return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY_MISSING' }) });
    if (projectId === 'restore-wrong-mime') return route.fulfill({ status: 200, contentType: 'image/jpeg', body: image });
    if (projectId === 'restore-wrong-size') return route.fulfill({ status: 200, contentType: 'image/png', body: image.subarray(0, image.length - 1) });
    return route.fulfill({ status: 200, contentType: 'image/png', body: image });
  } });

  await page.goto('/studio?projectId=restore-image');
  await expect(page.getByRole('button', { name: 'Choose another image' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove selected image' })).toBeVisible();
  await expect(page.locator('.ai-studio__image-preview img')).toBeVisible();
  await expect(page.getByText('restore-image', { exact: true })).toBeVisible();

  await page.goto('/studio?projectId=restore-multi');
  const thumbnails = page.locator('.ai-studio__thumbnails button');
  await expect(thumbnails).toHaveCount(2);
  await expect(thumbnails.nth(0)).toContainText('Trước');
  await expect(thumbnails.nth(1)).toContainText('Trái');
  await expect(thumbnails.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Đã chọn 2/8 ảnh.')).toBeVisible();

  for (const projectId of ['restore-missing', 'restore-wrong-mime', 'restore-wrong-size', 'restore-wrong-sha']) {
    await page.goto(`/studio?projectId=${projectId}`);
    await expect(page.getByText('Chưa khôi phục được ảnh nguồn từ Backend. Đọc lại dự án để thử lại.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose another image' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove selected image' })).toHaveCount(0);
    await expect(page.locator('.ai-studio__image-preview img')).toHaveCount(0);
  }
  await page.goto('/studio?projectId=restore-invalid-metadata');
  await expect(page.getByRole('region', { name: 'Bảng tạo mô hình' }).getByText('Backend chưa trả về đủ thông tin hợp lệ của dự án.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose another image' })).toHaveCount(0);
  expect(mutations).toEqual([]);
  expect(mutations.calls.filter(({ method }) => method === 'GET')).toEqual(expect.arrayContaining([
    expect.objectContaining({ pathname: '/api/ai-studio/projects/restore-image/inputs/image-input/content' }),
    expect.objectContaining({ pathname: '/api/ai-studio/projects/restore-multi/inputs/front-input/content' }),
    expect.objectContaining({ pathname: '/api/ai-studio/projects/restore-multi/inputs/left-input/content' }),
  ]));
});
