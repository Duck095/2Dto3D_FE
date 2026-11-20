import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';

const TEST_PROJECT = 'pipeline-project';
const activePipeline = (projectId = TEST_PROJECT, jobStatus = 'PROCESSING') => ({
  projectId,
  projectStatus: 'MODEL_GENERATING',
  referenceVersions: [],
  modelVersions: [],
  jobs: [{
    jobId: `job-${projectId}`, stage: 'MODEL_GENERATION', status: jobStatus, safeErrorCode: null,
    attemptCount: 1, createdAt: '2026-11-17T03:00:00Z', updatedAt: '2026-11-17T03:01:00Z',
  }],
});
const emptyPipeline = (projectId = TEST_PROJECT) => ({
  projectId, projectStatus: 'DRAFT', referenceVersions: [], modelVersions: [], jobs: [],
});
const versionPipeline = (projectId = TEST_PROJECT) => ({
  projectId,
  projectStatus: 'REFERENCES_REVIEW',
  referenceVersions: [
    { versionId: 'reference-v1', versionNumber: 1, status: 'APPROVED', availableViews: ['front', 'left'], parentVersionId: null, createdAt: '2026-11-17T03:00:00Z' },
    { versionId: 'reference-v2', versionNumber: 2, status: 'READY_FOR_REVIEW', availableViews: ['back'], parentVersionId: 'reference-v1', createdAt: '2026-11-17T03:01:00Z' },
  ],
  modelVersions: [
    { modelVersionId: 'model-v1', versionNumber: 1, referenceVersionId: 'reference-v1', status: 'CHANGES_REQUESTED', supersedesModelVersionId: null, artifactAvailable: false, createdAt: '2026-11-17T03:02:00Z' },
    { modelVersionId: 'model-v2', versionNumber: 2, referenceVersionId: 'reference-v2', status: 'READY_FOR_REVIEW', supersedesModelVersionId: 'model-v1', artifactAvailable: true, createdAt: '2026-11-17T03:03:00Z' },
  ],
  jobs: [{
    jobId: 'job-unlinked', stage: 'REFERENCE_GENERATION', status: 'FAILED', safeErrorCode: 'REFERENCE_TIMEOUT',
    attemptCount: 3, createdAt: '2026-11-17T03:04:00Z', updatedAt: '2026-11-17T03:05:00Z',
    referenceVersionId: 'must-not-be-inferred',
  }],
});

async function installSession(page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('morphia_access_token')) {
      const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.TEST_A`;
      localStorage.setItem('morphia_access_token', token);
      localStorage.setItem('morphia_user', JSON.stringify({ id: 'pipeline-user-a', email: 'a@example.invalid', token }));
    }
  });
}

async function mockPipelineApi(page, { onProjectHistory, onProject, onPipeline, onInputContent } = {}) {
  const calls = [];
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (!pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    calls.push({ method: request.method(), pathname, authorization: request.headers()['authorization'] || '' });
    if (pathname === '/api/v1/me' && request.method() === 'GET') {
      const userId = request.headers()['authorization']?.endsWith('TEST_B') ? 'pipeline-user-b' : 'pipeline-user-a';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: userId, name: 'Pipeline QA', email: `${userId}@example.invalid`, role: 'USER', contexts: ['CUSTOMER'],
      }) });
      return;
    }
    if (pathname === '/api/ai-studio/generations/history' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0 }) });
      return;
    }
    if (pathname === '/api/ai-studio/projects' && request.method() === 'GET') {
      if (onProjectHistory) {
        await onProjectHistory(route, request);
        return;
      }
      const referer = request.headers()['referer'] || '';
      const projectId = new URL(referer || 'http://localhost/studio').searchParams.get('projectId') || TEST_PROJECT;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        content: [{
          projectId, productType: 'figure', keychainVariant: null, styleId: 'chibi-collectible', inputMode: 'text',
          originalIdea: 'TEST_ONLY idea', status: 'DRAFT', createdAt: '2026-11-17T03:00:00Z', updatedAt: '2026-11-17T03:01:00Z',
          latestReferenceVersionId: null, latestModelVersionId: null,
        }],
        page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true,
      }) });
      return;
    }
    const projectMatch = pathname.match(/^\/api\/ai-studio\/projects\/([^/]+)$/);
    if (projectMatch && request.method() === 'GET') {
      const projectId = decodeURIComponent(projectMatch[1]);
      if (onProject) {
        await onProject(route, projectId, request);
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        projectId, productType: 'figure', styleId: 'chibi-collectible', inputMode: 'text', originalIdea: 'TEST_ONLY idea', status: 'DRAFT',
      }) });
      return;
    }
    const inputMatch = pathname.match(/^\/api\/ai-studio\/projects\/([^/]+)\/inputs\/([^/]+)\/content$/);
    if (inputMatch && request.method() === 'GET') {
      if (onInputContent) {
        await onInputContent(route, decodeURIComponent(inputMatch[1]), decodeURIComponent(inputMatch[2]), request);
        return;
      }
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY_NOT_FOUND' }) });
      return;
    }
    const pipelineMatch = pathname.match(/^\/api\/ai-studio\/projects\/([^/]+)\/pipeline$/);
    if (pipelineMatch && request.method() === 'GET') {
      const projectId = decodeURIComponent(pipelineMatch[1]);
      if (onPipeline) {
        await onPipeline(route, projectId, request);
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyPipeline(projectId)) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY_NOT_FOUND' }) });
  });
  return calls;
}

async function openProject(page, projectId = TEST_PROJECT) {
  await page.goto(`/studio?projectId=${encodeURIComponent(projectId)}`);
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Design Pipeline' })).toBeVisible();
}

function expectGetOnly(calls) {
  expect(calls.filter(call => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(call.method))).toEqual([]);
  expect(calls.filter(call => call.pathname.endsWith('/pipeline')).every(call => call.method === 'GET')).toBe(true);
}

test('confirmed Project GET precedes Pipeline GET and valid empty response renders no fabricated work', async ({ page }) => {
  await installSession(page);
  let releasePipeline;
  let signalPipeline;
  const pipelineStarted = new Promise(resolve => { signalPipeline = resolve; });
  const pendingPipeline = new Promise(resolve => { releasePipeline = resolve; });
  const calls = await mockPipelineApi(page, { onPipeline: async (route, projectId) => {
    signalPipeline();
    await pendingPipeline;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyPipeline(projectId)) });
  } });
  await openProject(page);
  await pipelineStarted;
  await expect(page.getByText('Đang đọc trạng thái Pipeline từ Backend…')).toBeVisible();
  await expect(page.getByText('Đã đọc dự án đã được Backend xác nhận.')).toBeVisible();
  await expect(page.getByLabel('Chi tiết dự án đang mở')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Generation History' })).toContainText(TEST_PROJECT);
  await expect(page.locator('.ai-studio__submit-block').getByRole('button', { name: 'Lưu dự án' })).toBeVisible();
  await expect(page.locator('.ai-studio__input-panel').getByRole('heading', { name: 'Design Project' })).toHaveCount(0);
  releasePipeline();
  await expect(page.getByText('Dự án đã được lưu, nhưng chưa có phiên bản ảnh tham chiếu, model hoặc công việc Pipeline nào được Backend ghi nhận.')).toBeVisible();
  await expect(page.getByText('Bản nháp')).toBeVisible();
  await expect(page.getByText('COMPLETED', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Reference Versions' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Model Versions' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Pipeline Jobs' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Design Project actions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo ảnh tham chiếu' })).toBeVisible();
  const projectGet = calls.findIndex(call => call.pathname === `/api/ai-studio/projects/${TEST_PROJECT}`);
  const pipelineGet = calls.findIndex(call => call.pathname === `/api/ai-studio/projects/${TEST_PROJECT}/pipeline`);
  expect(projectGet).toBeGreaterThanOrEqual(0);
  expect(pipelineGet).toBeGreaterThan(projectGet);
  expectGetOnly(calls);
});

test('confirmed Image Project restores its original source only after content size and SHA-256 match', async ({ page }) => {
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aQAAAABJRU5ErkJggg==', 'base64');
  const inputId = '6e7d7652-f76c-43da-a36d-880f3ee1e116';
  const sha256 = createHash('sha256').update(image).digest('hex');
  await installSession(page);
  const calls = await mockPipelineApi(page, {
    onProject: (route, projectId) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      projectId, productType: 'figure', styleId: 'chibi-collectible', inputMode: 'image', status: 'DRAFT', originalIdea: 'A small bird',
      inputs: [{ inputId, order: 0, mimeType: 'image/png', byteSize: image.length, sha256, clientSlot: null, viewHint: null }],
    }) }),
    onInputContent: (route, projectId, requestedInputId) => {
      expect(projectId).toBe(TEST_PROJECT);
      expect(requestedInputId).toBe(inputId);
      return route.fulfill({ status: 200, contentType: 'image/png', body: image });
    },
  });
  await openProject(page);
  await expect(page.getByRole('button', { name: 'Choose another image' })).toBeVisible();
  await expect(page.getByText('Backend chưa trả về nội dung ảnh nguồn có thể khôi phục')).toHaveCount(0);
  expect(calls.filter(call => call.pathname.endsWith(`/inputs/${inputId}/content`))).toHaveLength(1);
  expectGetOnly(calls);
});

test('confirmed MULTI Project restores ordered source files and view slots', async ({ page }) => {
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aQAAAABJRU5ErkJggg==', 'base64');
  const sha256 = createHash('sha256').update(image).digest('hex');
  const inputs = [
    { inputId: '6e7d7652-f76c-43da-a36d-880f3ee1e117', order: 0, mimeType: 'image/png', byteSize: image.length, sha256, clientSlot: 'front', viewHint: 'front' },
    { inputId: '6e7d7652-f76c-43da-a36d-880f3ee1e118', order: 1, mimeType: 'image/png', byteSize: image.length, sha256, clientSlot: 'left', viewHint: 'left' },
  ];
  await installSession(page);
  const calls = await mockPipelineApi(page, {
    onProject: (route, projectId) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      projectId, productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi', status: 'DRAFT', originalIdea: 'A small bird', inputs,
    }) }),
    onInputContent: (route) => route.fulfill({ status: 200, contentType: 'image/png', body: image }),
  });
  await openProject(page);
  await expect(page.locator('.ai-studio__thumbnails button')).toHaveCount(2);
  await expect(page.getByText('Backend chưa trả về đủ nội dung ảnh nguồn để khôi phục dự án MULTI')).toHaveCount(0);
  expect(calls.filter(call => /\/inputs\/[^/]+\/content$/.test(call.pathname))).toHaveLength(2);
  expectGetOnly(calls);
});

test('Project read failure never triggers a Pipeline GET', async ({ page }) => {
  await installSession(page);
  let pipelineReads = 0;
  const calls = await mockPipelineApi(page, {
    onProject: (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY_NOT_FOUND' }) }),
    onPipeline: (route) => {
      pipelineReads += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyPipeline()) });
    },
  });
  await page.goto(`/studio?projectId=${TEST_PROJECT}`);
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bảng tạo mô hình' }).getByText('Backend không trả về dự án hợp lệ.')).toBeVisible();
  expect(pipelineReads).toBe(0);
  expectGetOnly(calls);
});

test('renders only Backend-returned versions, slots, model references and unlinked job details', async ({ page }) => {
  await installSession(page);
  const calls = await mockPipelineApi(page, { onPipeline: (route, projectId) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(versionPipeline(projectId)) }) });
  await openProject(page);
  await expect(page.getByText('Ảnh tham chiếu chờ duyệt')).toBeVisible();
  await expect(page.getByText('Available views: front, left')).toBeVisible();
  await expect(page.getByText('Parent version: reference-v1')).toBeVisible();
  await expect(page.getByText('Reference version: reference-v2')).toBeVisible();
  await expect(page.getByText('Artifact: Có sẵn')).toBeVisible();
  await expect(page.getByText('Mã lỗi: REFERENCE_TIMEOUT')).toBeVisible();
  await expect(page.getByText('must-not-be-inferred')).toHaveCount(0);
  expectGetOnly(calls);
});

test('PENDING and PROCESSING jobs trigger sequential polling no faster than eight seconds and stop at fifteen reads', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T03:00:00Z') });
  await installSession(page);
  let pipelineRead = 0;
  const calls = await mockPipelineApi(page, { onPipeline: (route, projectId) => {
    const status = pipelineRead++ === 0 ? 'PENDING' : 'PROCESSING';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activePipeline(projectId, status)) });
  } });
  await openProject(page);
  const pipelineCalls = () => calls.filter(call => call.pathname.endsWith('/pipeline'));
  await expect.poll(() => pipelineCalls().length).toBe(1);
  for (let automaticRead = 1; automaticRead < 15; automaticRead += 1) {
    await page.clock.fastForward(8000);
    await expect.poll(() => pipelineCalls().length).toBe(automaticRead + 1);
  }
  expect(pipelineCalls()).toHaveLength(15);
  await page.clock.fastForward(120_000);
  expect(pipelineCalls()).toHaveLength(15);
  await expect(page.getByRole('button', { name: 'Đọc lại Pipeline' })).toBeVisible();
  await expect(page.getByText(/Đã tạm dừng tự cập nhật sau giới hạn theo dõi/)).toBeVisible();
  expectGetOnly(calls);
});

test('failed jobs show only a safe error code and terminal or unknown jobs do not poll', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T03:00:00Z') });
  await installSession(page);
  const calls = await mockPipelineApi(page, { onPipeline: (route, projectId) => {
    const status = projectId === TEST_PROJECT ? 'FAILED' : projectId.replace('terminal-', '');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ...activePipeline(projectId, status), jobs: [{ ...activePipeline(projectId, status).jobs[0], safeErrorCode: 'BAD_CODE: internal stack' }],
    }) });
  } });
  await openProject(page);
  await expect(page.getByText('Backend báo công việc thất bại.')).toBeVisible();
  expect(calls.filter(call => call.pathname.endsWith('/pipeline'))).toHaveLength(1);
  await page.clock.fastForward(40_000);
  expect(calls.filter(call => call.pathname.endsWith('/pipeline'))).toHaveLength(1);
  for (const status of ['COMPLETED', 'CANCELLED', 'FUTURE_JOB_STATE']) {
    await page.goto(`/studio?projectId=terminal-${status}`);
    await expect(page.getByRole('heading', { name: 'Design Pipeline' })).toBeVisible();
    const terminalPipelineCalls = () => calls.filter(call => call.pathname.endsWith('/pipeline') && call.pathname.includes(`terminal-${status}`));
    await expect.poll(() => terminalPipelineCalls().length).toBe(1);
    if (status === 'FUTURE_JOB_STATE') await expect(page.getByText('Trạng thái chưa nhận diện')).toBeVisible();
    await page.clock.fastForward(24_000);
    expect(terminalPipelineCalls()).toHaveLength(1);
  }
  expectGetOnly(calls);
});

test('401, 403, 404, 409, 429 and 5xx show safe states without private Pipeline data', async ({ page }) => {
  await installSession(page);
  const calls = await mockPipelineApi(page, { onPipeline: async (route, projectId) => {
    const status = Number(projectId.replace('pipeline-', ''));
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY', message: 'internal stack SECRET' }) });
  } });
  for (const status of [401, 403, 404, 409, 429, 503]) {
    await page.goto(`/studio?projectId=pipeline-${status}`);
    await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
    const safeMessage = status === 401
      ? 'Phiên đăng nhập cần được xác thực lại trước khi đọc Pipeline.'
      : [403, 404].includes(status)
        ? 'Pipeline chưa khả dụng hoặc tài khoản hiện không có quyền đọc.'
        : 'Chưa đọc được trạng thái Pipeline từ Backend. Bạn có thể thử đọc lại.';
    await expect(page.getByText(safeMessage)).toBeVisible();
    await expect(page.getByText('SECRET')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Thử đọc lại' })).toHaveCount([401, 403, 404].includes(status) ? 0 : 1);
  }
  expectGetOnly(calls);
});

test('malformed success is not an empty success and manual retry performs one new GET', async ({ page }) => {
  await installSession(page);
  let pipelineRead = 0;
  const calls = await mockPipelineApi(page, { onPipeline: (route, projectId) => {
    pipelineRead += 1;
    const body = pipelineRead === 1 ? { projectId, projectStatus: 'DRAFT', referenceVersions: [] } : emptyPipeline(projectId);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  } });
  await openProject(page);
  await expect(page.getByText('Backend trả về dữ liệu Pipeline chưa hợp lệ. Bạn có thể thử đọc lại.')).toBeVisible();
  await expect(page.getByText('Dự án đã được lưu, nhưng chưa có phiên bản ảnh tham chiếu, model hoặc công việc Pipeline nào được Backend ghi nhận.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Thử đọc lại' }).click();
  await expect(page.getByText('Dự án đã được lưu, nhưng chưa có phiên bản ảnh tham chiếu, model hoặc công việc Pipeline nào được Backend ghi nhận.')).toBeVisible();
  expect(calls.filter(call => call.pathname.endsWith('/pipeline'))).toHaveLength(2);
  expectGetOnly(calls);
});

test('late response for a prior Project cannot replace the new Project Pipeline', async ({ page }) => {
  await installSession(page);
  let releaseOld;
  let signalOld;
  const oldStarted = new Promise(resolve => { signalOld = resolve; });
  const oldResponse = new Promise(resolve => { releaseOld = resolve; });
  const calls = await mockPipelineApi(page, { onPipeline: async (route, projectId) => {
    if (projectId === 'pipeline-old') {
      signalOld();
      await oldResponse;
      try { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...emptyPipeline(projectId), projectStatus: 'A_PRIVATE_PROJECT_STATUS' }) }); } catch { /* Route was cancelled when the Project changed. */ }
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...emptyPipeline(projectId), projectStatus: 'DRAFT' }) });
  } });
  await page.goto('/studio?projectId=pipeline-old');
  await oldStarted;
  await page.goto('/studio?projectId=pipeline-new');
  await expect(page.getByText('Bản nháp')).toBeVisible();
  releaseOld();
  await page.waitForTimeout(50);
  await expect(page.getByText('A_PRIVATE_PROJECT_STATUS')).toHaveCount(0);
  expectGetOnly(calls);
});

test('account switch hides the previous owner Pipeline response', async ({ page }) => {
  await installSession(page);
  let releaseAccountA;
  let signalAccountA;
  const accountAStarted = new Promise(resolve => { signalAccountA = resolve; });
  const accountAResponse = new Promise(resolve => { releaseAccountA = resolve; });
  const calls = await mockPipelineApi(page, { onPipeline: async (route, projectId, request) => {
    if (request.headers()['authorization']?.endsWith('TEST_A')) {
      signalAccountA();
      await accountAResponse;
      try { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...emptyPipeline(projectId), projectStatus: 'A_PRIVATE_STATUS' }) }); } catch { /* Navigation aborts the old owner's GET. */ }
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...emptyPipeline(projectId), projectStatus: 'DRAFT' }) });
  } });
  await page.goto(`/studio?projectId=${TEST_PROJECT}`);
  await accountAStarted;
  await page.evaluate(() => {
    const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.TEST_B`;
    localStorage.setItem('morphia_access_token', token);
    localStorage.setItem('morphia_user', JSON.stringify({ id: 'pipeline-user-b', email: 'b@example.invalid', token }));
  });
  await page.reload();
  await expect(page.getByText('Bản nháp')).toBeVisible();
  releaseAccountA();
  await page.waitForTimeout(50);
  await expect(page.getByText('A_PRIVATE_STATUS')).toHaveCount(0);
  expectGetOnly(calls);
});

test('logout aborts active Pipeline polling and clears private Pipeline data', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T03:00:00Z') });
  await installSession(page);
  const calls = await mockPipelineApi(page, { onPipeline: (route, projectId) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activePipeline(projectId)) }) });
  await openProject(page);
  await expect(page.getByText('Đang dựng model')).toBeVisible();
  await page.getByRole('button', { name: 'Tài khoản' }).click();
  await page.getByRole('button', { name: 'Đăng xuất' }).last().click();
  await expect(page).toHaveURL(/\/(?:login)?$/);
  expect(await page.getByText('job-pipeline-project').count()).toBe(0);
  const countAfterLogout = calls.filter(call => call.pathname.endsWith('/pipeline')).length;
  await page.clock.fastForward(120_000);
  expect(calls.filter(call => call.pathname.endsWith('/pipeline'))).toHaveLength(countAfterLogout);
  expectGetOnly(calls);
});

test('unmount cleanup cancels a pending Pipeline poll timer', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T03:00:00Z') });
  await installSession(page);
  const calls = await mockPipelineApi(page, { onPipeline: (route, projectId) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activePipeline(projectId)) }) });
  await openProject(page);
  await expect(page.getByText('Đang dựng model')).toBeVisible();
  await page.goto('/products');
  const countAfterUnmount = calls.filter(call => call.pathname.endsWith('/pipeline')).length;
  await page.clock.fastForward(120_000);
  expect(calls.filter(call => call.pathname.endsWith('/pipeline'))).toHaveLength(countAfterUnmount);
  expectGetOnly(calls);
});

test('background tab stops polling and requires a manual read after becoming visible', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T03:00:00Z') });
  await installSession(page);
  const calls = await mockPipelineApi(page, { onPipeline: (route, projectId) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activePipeline(projectId)) }) });
  await openProject(page);
  const pipelineCalls = () => calls.filter(call => call.pathname.endsWith('/pipeline'));
  await expect.poll(() => pipelineCalls().length).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('Đã tạm dừng đọc Pipeline khi tab chạy nền. Chọn đọc lại để cập nhật.')).toBeVisible();
  await page.clock.fastForward(80_000);
  expect(pipelineCalls()).toHaveLength(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: 'Đọc lại Pipeline' }).click();
  await expect.poll(() => pipelineCalls().length).toBe(2);
  expectGetOnly(calls);
});

test('Pipeline panel remains within the viewport at desktop, tablet and mobile widths', async ({ page }) => {
  await installSession(page);
  const calls = await mockPipelineApi(page, { onPipeline: (route, projectId) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(versionPipeline(projectId)) }) });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/studio?projectId=${TEST_PROJECT}`);
    if (width <= 960) await page.getByRole('button', { name: 'Mở bảng ý tưởng' }).click();
    await expect(page.getByRole('heading', { name: 'Design Pipeline' })).toBeVisible();
    await expect(page.locator('.ai-studio__pipeline')).toBeVisible();
    const dimensions = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  }
  expectGetOnly(calls);
});
