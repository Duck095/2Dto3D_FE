import { expect, test } from '@playwright/test';

const emptyPipeline = projectId => ({ projectId, projectStatus: 'DRAFT', referenceVersions: [], modelVersions: [], jobs: [] });
const summary = (projectId, extra = {}) => ({
  projectId, productType: 'figure', keychainVariant: null, styleId: 'chibi-collectible', inputMode: 'text',
  originalIdea: `Idea ${projectId}`, status: 'DRAFT', createdAt: '2026-11-18T10:00:00Z', updatedAt: '2026-11-18T10:05:00Z',
  latestReferenceVersionId: null, latestModelVersionId: null, ...extra,
});

async function installSession(page, account = 'A') {
  await page.addInitScript(accountId => {
    if (sessionStorage.getItem('history-session-initialized')) return;
    sessionStorage.setItem('history-session-initialized', 'true');
    if (localStorage.getItem('morphia_access_token')) return;
    const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.HISTORY_${accountId}`;
    localStorage.setItem('morphia_access_token', token);
    localStorage.setItem('morphia_user', JSON.stringify({ id: `history-user-${accountId}`, email: `${accountId}@example.invalid`, token }));
  }, account);
}

async function installApi(page, {
  projectsByAccount = { A: [], B: [] },
  onHistory,
  onPost,
  onProject,
} = {}) {
  const calls = [];
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const authorization = request.headers()['authorization'] || '';
    const account = authorization.endsWith('HISTORY_B') ? 'B' : 'A';
    calls.push({ method: request.method(), path, page: url.searchParams.get('page'), size: url.searchParams.get('size'), account });
    if (path === '/api/v1/me') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: `history-user-${account}`, name: `History ${account}`, email: `${account}@example.invalid`, role: 'USER', contexts: ['CUSTOMER'],
      }) });
    }
    if (path === '/api/auth/login' && request.method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'history-user-A', name: 'History A', email: 'A@example.invalid', role: 'USER',
        token: `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.HISTORY_A_RELOGIN`,
      }) });
    }
    if (path === '/api/ai-studio/generations/history') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0 }) });
    }
    if (path === '/api/ai-studio/projects' && request.method() === 'GET') {
      if (onHistory) return onHistory(route, request, account, calls);
      const pageNumber = Number(url.searchParams.get('page') || 0);
      const size = Number(url.searchParams.get('size') || 20);
      const all = projectsByAccount[account] || [];
      const content = all.slice(pageNumber * size, (pageNumber + 1) * size);
      const totalPages = Math.ceil(all.length / size);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        content, page: pageNumber, size, totalElements: all.length, totalPages,
        first: pageNumber === 0, last: totalPages === 0 || pageNumber >= totalPages - 1,
      }) });
    }
    if (path === '/api/ai-studio/projects' && request.method() === 'POST') {
      if (onPost) return onPost(route, request, account, projectsByAccount);
      const created = summary('created-project');
      projectsByAccount[account].unshift(created);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ projectId: created.projectId }) });
    }
    const projectMatch = path.match(/^\/api\/ai-studio\/projects\/([^/]+)$/);
    if (projectMatch && request.method() === 'GET') {
      const projectId = decodeURIComponent(projectMatch[1]);
      if (onProject) return onProject(route, projectId, account);
      const project = (projectsByAccount[account] || []).find(item => item.projectId === projectId) || summary(projectId);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        projectId, productType: project.productType, keychainVariant: project.keychainVariant, styleId: project.styleId,
        inputMode: project.inputMode, originalIdea: project.originalIdea, status: project.status, inputs: [],
      }) });
    }
    const pipelineMatch = path.match(/^\/api\/ai-studio\/projects\/([^/]+)\/pipeline$/);
    if (pipelineMatch && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyPipeline(decodeURIComponent(pipelineMatch[1]))) });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY_NOT_FOUND' }) });
  });
  return calls;
}

async function openStudio(page, width = 1440) {
  await page.setViewportSize({ width, height: 950 });
  await page.goto('/studio?mode=text');
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
}

test('creating a Project refreshes History and reload still lists it for the authenticated account', async ({ page }) => {
  await installSession(page);
  const projects = { A: [], B: [] };
  const calls = await installApi(page, {
    projectsByAccount: projects,
    onPost: async (route, request, account, allProjects) => {
      const created = summary('created-project', { originalIdea: 'A small bird sculpture' });
      allProjects[account].unshift(created);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ projectId: created.projectId }) });
    },
  });
  await openStudio(page);
  await expect(page.getByRole('heading', { name: 'Dự án đã lưu' })).toBeVisible();
  await expect(page.getByText('Backend chưa có dự án đã lưu.')).toBeVisible();

  await page.getByRole('button', { name: 'Tượng 3D' }).click();
  await page.getByPlaceholder(/Describe the 3D model you want to create/).fill('A small bird sculpture');
  await page.getByRole('button', { name: 'Lưu dự án' }).click();
  const projectItem = page.getByRole('button', { name: /A small bird sculpture/ });
  await expect(projectItem).toBeVisible();
  await expect(projectItem).toHaveAttribute('aria-current', 'page');
  expect(calls.filter(call => call.path === '/api/ai-studio/projects' && call.method === 'GET').length).toBeGreaterThanOrEqual(2);
  expect(calls.filter(call => call.path === '/api/ai-studio/projects' && call.method === 'POST')).toHaveLength(1);

  await page.reload();
  await expect(page.getByRole('button', { name: /A small bird sculpture/ })).toBeVisible();
  expect(calls.some(call => call.path === '/api/ai-studio/projects' && call.method === 'GET' && call.account === 'A')).toBe(true);
});

test('selecting a Project opens its projectId in the existing Studio route and highlights it', async ({ page }) => {
  await installSession(page);
  const project = summary('older-project');
  const calls = await installApi(page, { projectsByAccount: { A: [project], B: [] } });
  await openStudio(page);
  await page.getByRole('button', { name: /Idea older-project/ }).click();
  await expect(page).toHaveURL(/\/studio\?projectId=older-project/);
  await expect(page.getByRole('button', { name: /Idea older-project/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByLabel('Chi tiết dự án đang mở')).toContainText('older-project');
  expect(calls.some(call => call.path === '/api/ai-studio/projects/older-project' && call.method === 'GET')).toBe(true);
  expect(calls.some(call => call.path === '/api/ai-studio/projects/older-project/pipeline' && call.method === 'GET')).toBe(true);
});

test('direct deep link shows a page-two Project and moves details into its single History entry after load more', async ({ page }) => {
  await installSession(page);
  const projects = Array.from({ length: 21 }, (_, index) => summary(`deep-project-${index + 1}`));
  const target = projects[20];
  const calls = await installApi(page, { projectsByAccount: { A: projects, B: [] } });

  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${target.projectId}`);
  await expect(page.locator('.ai-studio-page-shell')).toBeVisible();
  await expect(page.getByLabel('Chi tiết dự án đang mở')).toContainText(target.projectId);
  await expect(page.getByLabel('Chi tiết dự án đang mở')).toContainText(`Idea ${target.projectId}`);
  await expect(page.getByRole('heading', { name: 'Design Pipeline' })).toBeVisible();
  await expect(page.getByText('Dự án đã được lưu, nhưng chưa có phiên bản ảnh tham chiếu, model hoặc công việc Pipeline nào được Backend ghi nhận.')).toBeVisible();
  await expect(page.getByRole('button', { name: `Idea ${target.projectId}` })).toHaveCount(0);
  expect(calls.some(call => call.path === `/api/ai-studio/projects/${target.projectId}` && call.method === 'GET')).toBe(true);
  expect(calls.some(call => call.path === `/api/ai-studio/projects/${target.projectId}/pipeline` && call.method === 'GET')).toBe(true);

  await page.getByRole('button', { name: 'Tải thêm dự án' }).click();
  await expect(page.getByRole('button', { name: `Idea ${target.projectId}` })).toHaveCount(1);
  await expect(page.getByLabel('Chi tiết dự án đang mở')).toHaveCount(1);
  await expect(page.locator('.ai-studio__history-project-item').filter({ hasText: `Idea ${target.projectId}` })).toHaveAttribute('aria-current', 'page');
});

test('direct Project details and Pipeline remain available when History GET fails', async ({ page }) => {
  await installSession(page);
  const target = summary('deep-history-failure-project');
  const calls = await installApi(page, {
    projectsByAccount: { A: [target], B: [] },
    onHistory: route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY' }) }),
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${target.projectId}`);
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa tải được danh sách dự án từ Backend.' })).toBeVisible();
  await expect(page.getByLabel('Chi tiết dự án đang mở')).toContainText(target.projectId);
  await expect(page.getByRole('heading', { name: 'Design Pipeline' })).toBeVisible();
  expect(calls.some(call => call.path === `/api/ai-studio/projects/${target.projectId}/pipeline` && call.method === 'GET')).toBe(true);
});

test('logout and login again for the same account reloads History from the API', async ({ page }) => {
  await installSession(page, 'A');
  const projectA = summary('relogin-project-a', { originalIdea: 'Backend-owned project A' });
  const calls = await installApi(page, { projectsByAccount: { A: [projectA], B: [] } });
  await openStudio(page);
  await expect(page.getByRole('button', { name: /Backend-owned project A/ })).toBeVisible();
  const firstHistoryReadCount = calls.filter(call => call.path === '/api/ai-studio/projects' && call.method === 'GET').length;

  await page.getByRole('button', { name: 'Tài khoản' }).click();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
  await page.goto('/studio?mode=text');
  await expect(page.getByRole('button', { name: /Backend-owned project A/ })).toHaveCount(0);

  await page.goto('/login');
  await page.getByLabel('Địa chỉ email').fill('A@example.invalid');
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('test-password-123');
  const loginResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/login');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await loginResponse;
  await expect(page.getByRole('button', { name: 'Tài khoản' })).toBeVisible();
  await page.goto('/studio?mode=text');
  await expect(page.getByRole('button', { name: /Backend-owned project A/ })).toBeVisible();
  const historyReads = calls.filter(call => call.path === '/api/ai-studio/projects' && call.method === 'GET');
  expect(historyReads.length).toBeGreaterThan(firstHistoryReadCount);
  expect(historyReads.slice(firstHistoryReadCount).every(call => call.account === 'A')).toBe(true);
});

test('an account change while a direct Project response is pending never reveals the prior owner details', async ({ page }) => {
  await installSession(page, 'A');
  const projectId = 'owner-pending-project';
  let releaseA;
  let signalA;
  const waitingA = new Promise(resolve => { signalA = resolve; });
  const responseA = new Promise(resolve => { releaseA = resolve; });
  await installApi(page, {
    projectsByAccount: { A: [summary(projectId)], B: [summary(projectId)] },
    onProject: async (route, requestedId, account) => {
      if (account === 'A') {
        signalA();
        await responseA;
        try {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            projectId: requestedId, productType: 'figure', styleId: 'chibi-collectible', inputMode: 'text', originalIdea: 'PRIVATE OWNER A DETAIL', status: 'DRAFT',
          }) });
        } catch { /* Owner change aborts the prior account request. */ }
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        projectId: requestedId, productType: 'figure', styleId: 'chibi-collectible', inputMode: 'text', originalIdea: 'OWNER B DETAIL', status: 'DRAFT',
      }) });
    },
  });

  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${projectId}`);
  await waitingA;
  await expect(page.getByRole('region', { name: 'Bảng tạo mô hình' }).getByText('Đang đọc dự án từ Backend…')).toBeVisible();
  await expect(page.getByLabel('Chi tiết dự án đang mở')).toHaveCount(0);
  await page.evaluate(() => {
    const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.HISTORY_B`;
    localStorage.setItem('morphia_access_token', token);
    localStorage.setItem('morphia_user', JSON.stringify({ id: 'history-user-B', email: 'B@example.invalid', token }));
  });
  await page.reload();
  await expect(page.getByLabel('Chi tiết dự án đang mở')).toContainText('OWNER B DETAIL');
  releaseA();
  await page.waitForTimeout(50);
  await expect(page.getByLabel('Chi tiết dự án đang mở')).not.toContainText('PRIVATE OWNER A DETAIL');
  await expect(page.getByLabel('Chi tiết dự án đang mở')).toContainText('OWNER B DETAIL');
});

test('load more appends page two and deduplicates projectId without hiding earlier items', async ({ page }) => {
  await installSession(page);
  const projects = Array.from({ length: 20 }, (_, index) => summary(`project-${index + 1}`));
  const calls = await installApi(page, {
    onHistory: (route, request, account) => {
      const pageNumber = Number(new URL(request.url()).searchParams.get('page'));
      if (account !== 'A') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], page: pageNumber, size: 20, totalElements: 0, totalPages: 0, first: true, last: true }) });
      const content = pageNumber === 0 ? projects : [projects[19], summary('project-21')];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        content, page: pageNumber, size: 20, totalElements: 21, totalPages: 2, first: pageNumber === 0, last: pageNumber === 1,
      }) });
    },
  });
  await openStudio(page, 1024);
  await expect(page.locator('.ai-studio__history-project-item')).toHaveCount(20);
  await page.getByRole('button', { name: 'Tải thêm dự án' }).evaluate(button => { button.click(); button.click(); });
  await expect(page.getByRole('button', { name: 'Idea project-21' })).toBeVisible();
  await expect(page.locator('.ai-studio__history-project-item')).toHaveCount(21);
  await expect(page.getByRole('button', { name: 'Idea project-20' })).toHaveCount(1);
  expect(calls.filter(call => call.path === '/api/ai-studio/projects' && call.method === 'GET').map(call => call.page)).toEqual(['0', '1']);
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
});

test('a failed second page keeps existing projects and retries the same page', async ({ page }) => {
  await installSession(page);
  const projects = Array.from({ length: 20 }, (_, index) => summary(`retry-project-${index + 1}`));
  let secondPageReads = 0;
  const calls = await installApi(page, {
    onHistory: (route, request) => {
      const pageNumber = Number(new URL(request.url()).searchParams.get('page'));
      if (pageNumber === 0) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: projects, page: 0, size: 20, totalElements: 21, totalPages: 2, first: true, last: false }) });
      secondPageReads += 1;
      if (secondPageReads === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [summary('retry-project-21')], page: 1, size: 20, totalElements: 21, totalPages: 2, first: false, last: true }) });
    },
  });
  await openStudio(page);
  await expect(page.locator('.ai-studio__history-project-item')).toHaveCount(20);
  await page.getByRole('button', { name: 'Tải thêm dự án' }).click();
  await expect(page.getByText(/Chưa tải được danh sách dự án từ Backend/)).toBeVisible();
  await expect(page.locator('.ai-studio__history-project-item').first()).toContainText('Idea retry-project-1');
  await expect(page.locator('.ai-studio__history-project-item')).toHaveCount(20);
  await page.getByRole('button', { name: 'Thử tải lại trang tiếp theo' }).click();
  await expect(page.getByRole('button', { name: 'Idea retry-project-21' })).toBeVisible();
  await expect(page.locator('.ai-studio__history-project-item')).toHaveCount(21);
  expect(calls.filter(call => call.path === '/api/ai-studio/projects' && call.method === 'GET').map(call => call.page)).toEqual(['0', '1', '1']);
});

test('empty and failed Project History responses show truthful states and Retry', async ({ page }) => {
  await installSession(page);
  let listReads = 0;
  await installApi(page, {
    onHistory: (route, request) => {
      listReads += 1;
      if (listReads === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true }) });
    },
  });
  await openStudio(page);
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa tải được danh sách dự án từ Backend.' })).toBeVisible();
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByText('Backend chưa có dự án đã lưu.')).toBeVisible();
  expect(listReads).toBe(2);
});

test('History is account-scoped after reload and works on mobile without horizontal overflow', async ({ page }) => {
  await installSession(page, 'A');
  await installApi(page, { projectsByAccount: { A: [summary('private-a')], B: [summary('private-b')] } });
  await openStudio(page, 390);
  await expect(page.getByRole('button', { name: /Idea private-a/ })).toBeVisible();
  await page.evaluate(() => {
    const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.HISTORY_B`;
    localStorage.setItem('morphia_access_token', token);
    localStorage.setItem('morphia_user', JSON.stringify({ id: 'history-user-B', email: 'B@example.invalid', token }));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /Idea private-b/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Idea private-a/ })).toHaveCount(0);
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
});

test('a delayed Project History response from a previous account is ignored after account change', async ({ page }) => {
  await installSession(page, 'A');
  let releaseA;
  let signalA;
  const waitingA = new Promise(resolve => { signalA = resolve; });
  const responseA = new Promise(resolve => { releaseA = resolve; });
  await installApi(page, {
    projectsByAccount: { A: [summary('private-a')], B: [summary('private-b')] },
    onHistory: async (route, request, account) => {
      if (account === 'A') {
        signalA();
        await responseA;
        try {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [summary('private-a')], page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true }) });
        } catch { /* Owner change aborts the prior account request. */ }
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [summary('private-b')], page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true }) });
    },
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/studio?mode=text');
  await signalA;
  await expect(page.getByText('Đang tải danh sách dự án…')).toBeVisible();
  await page.evaluate(() => {
    const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.HISTORY_B`;
    localStorage.setItem('morphia_access_token', token);
    localStorage.setItem('morphia_user', JSON.stringify({ id: 'history-user-B', email: 'B@example.invalid', token }));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /Idea private-b/ })).toBeVisible();
  releaseA();
  await page.waitForTimeout(50);
  await expect(page.getByRole('button', { name: /Idea private-a/ })).toHaveCount(0);
});
