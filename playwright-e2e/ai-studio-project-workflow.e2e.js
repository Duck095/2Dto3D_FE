import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const REFERENCE_V1 = '22222222-2222-4222-8222-222222222222';
const REFERENCE_V2 = '33333333-3333-4333-8333-333333333333';
const MODEL_V1 = '44444444-4444-4444-8444-444444444444';
const MODEL_V2 = '55555555-5555-4555-8555-555555555556';
const JOB_REFERENCE = '55555555-5555-4555-8555-555555555555';
const JOB_MODEL = '66666666-6666-4666-8666-666666666666';
const APPROVAL_REFERENCE = '77777777-7777-4777-8777-777777777777';
const APPROVAL_MODEL = '88888888-8888-4888-8888-888888888888';
const STAMP = '2026-11-18T10:00:00Z';
const EMPTY_TIMELINE = { projectId: PROJECT_ID, events: [] };

function glbV2(vertices = [0, 0, 0, 1, 0, 0, 0, 1, 0]) {
  const positions = new Float32Array(vertices);
  const binary = new Uint8Array(positions.buffer);
  const json = JSON.stringify({
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ byteLength: binary.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: binary.byteLength, target: 34962 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
  });
  const jsonBytes = new TextEncoder().encode(json);
  const paddedLength = Math.ceil(jsonBytes.length / 4) * 4;
  const binaryPaddedLength = Math.ceil(binary.byteLength / 4) * 4;
  const buffer = new ArrayBuffer(28 + paddedLength + binaryPaddedLength);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, paddedLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20, jsonBytes.length).set(jsonBytes);
  new Uint8Array(buffer, 20 + jsonBytes.length, paddedLength - jsonBytes.length).fill(0x20);
  view.setUint32(20 + paddedLength, binaryPaddedLength, true);
  view.setUint32(24 + paddedLength, 0x004e4942, true);
  new Uint8Array(buffer, 28 + paddedLength, binary.byteLength).set(binary);
  return Buffer.from(buffer);
}

const image = await readFile(new URL('../public/products/cute-flexi-baby-dragon/preview_reference.png', import.meta.url));
const imageSha256 = createHash('sha256').update(image).digest('hex');

async function installSession(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('workflow-session-installed') === 'true') return;
    sessionStorage.setItem('workflow-session-installed', 'true');
    const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.WORKFLOW_A`;
    localStorage.setItem('morphia_access_token', token);
    localStorage.setItem('morphia_user', JSON.stringify({ id: 'workflow-user-a', email: 'a@example.invalid', token }));
  });
}

function makeReferenceVersion({ status, views = [], versionId = REFERENCE_V1, versionNumber = 1, parentVersionId = null }) {
  return {
    versionId,
    versionNumber,
    status,
    availableViews: views,
    parentVersionId,
    createdAt: STAMP,
  };
}

function makePipeline(projectStatus = 'DRAFT') {
  return { projectId: PROJECT_ID, projectStatus, referenceVersions: [], modelVersions: [], jobs: [] };
}

function makeInitialApprovedModelPipeline(modelVersionCount = 1) {
  return {
    ...makePipeline('COMPLETED'),
    modelVersions: Array.from({ length: modelVersionCount }, (_, index) => ({
      modelVersionId: index === 0 ? MODEL_V1 : MODEL_V2,
      versionNumber: index + 1,
      referenceVersionId: REFERENCE_V1,
      status: 'APPROVED',
      supersedesModelVersionId: index === 0 ? null : MODEL_V1,
      artifactAvailable: true,
      createdAt: STAMP,
    })),
    jobs: [{ jobId: JOB_MODEL, stage: 'MODEL_MESH', status: 'COMPLETED', safeErrorCode: null, attemptCount: 1, createdAt: STAMP, updatedAt: STAMP }],
  };
}

async function installWorkflowApi(page, { onGenerateReference, onModelArtifact, onPrintReadiness, printReadinessResponses = [], progressReferences = false, failFirstReference = false, uncertainFirstReference = false, invalidReferenceBytes = false, mismatchReferenceHash = false, initialApprovedModel = false, initialModelVersions = 1 } = {}) {
  const calls = [];
  let pipeline = initialApprovedModel ? makeInitialApprovedModelPipeline(initialModelVersions) : makePipeline();
  let currentReferenceId = '';
  let currentReferenceNumber = 0;
  let referenceGenerationCount = 0;
  let referenceSnapshots = [];
  let referenceApprovalDecision = null;
  let modelApprovalDecision = null;
  const referenceImage = invalidReferenceBytes ? Buffer.from('not an image') : image;
  const model = glbV2();
  const modelSha256 = createHash('sha256').update(model).digest('hex');
  let readinessResponseCount = 0;
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    calls.push({ method: request.method(), path, body: request.postDataJSON?.() || null, idempotencyKey: request.headers()['idempotency-key'] || '' });
    if (path === '/api/v1/me') {
      const account = request.headers()['authorization']?.endsWith('WORKFLOW_B') ? 'b' : 'a';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: `workflow-user-${account}`, email: `${account}@example.invalid`, role: 'USER', contexts: ['CUSTOMER'] }) });
    }
    if (path === '/api/ai-studio/generations/history') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0 }) });
    if (path === '/api/ai-studio/projects' && request.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true }) });
    if (path === `/api/ai-studio/projects/${PROJECT_ID}` && request.method() === 'GET') {
      if (request.headers()['authorization']?.endsWith('WORKFLOW_B')) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY_NOT_FOUND' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ projectId: PROJECT_ID, productType: 'figure', keychainVariant: null, styleId: 'chibi-collectible', inputMode: 'text', originalIdea: 'Workflow fixture project', status: pipeline.projectStatus, inputs: [] }) });
    }
    if (path === `/api/ai-studio/projects/${PROJECT_ID}/pipeline` && request.method() === 'GET') {
      const responsePipeline = referenceSnapshots.length ? referenceSnapshots.shift() : pipeline;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responsePipeline) });
    }
    if (path === `/api/ai-studio/projects/${PROJECT_ID}/timeline` && request.method() === 'GET') {
      const reference = pipeline.referenceVersions.find(version => version.versionId === currentReferenceId && version.availableViews.length === 4);
      const events = reference ? [{
        eventId: '99999999-9999-4999-8999-999999999999', eventType: 'REFERENCE_VERSION', recordType: 'VERSION_STATUS_SNAPSHOT',
        occurredAt: STAMP, versionId: reference.versionId, status: reference.status, decision: null, feedback: null,
        parentId: reference.parentVersionId, supersedesId: null, viewSlot: null, imageVersionId: null, artifactUrl: null,
        mimeType: null, byteSize: null, sha256: null, stage: null, attemptCount: null, safeErrorCode: null,
        referenceViews: reference.availableViews.map((viewSlot, index) => ({
          viewSlot, imageVersionId: `${index + 1}`.padStart(8, '0') + '-9999-4999-8999-999999999999', imageVersionNumber: 1,
          supersedesImageVersionId: null, artifactUrl: `/api/ai-studio/projects/${PROJECT_ID}/references/${reference.versionId}/views/${viewSlot}`,
          mimeType: 'image/png', byteSize: referenceImage.byteLength,
          sha256: mismatchReferenceHash ? '0'.repeat(64) : createHash('sha256').update(referenceImage).digest('hex'), createdAt: STAMP,
        })),
      }] : [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ projectId: PROJECT_ID, events }) });
    }
    if (path === `/api/ai-studio/projects/${PROJECT_ID}/references/generate` && request.method() === 'POST') {
      if (onGenerateReference) return onGenerateReference(route, request);
      referenceGenerationCount += 1;
      if (uncertainFirstReference && referenceGenerationCount === 1) return route.abort('failed');
      const command = request.postDataJSON();
      currentReferenceNumber += 1;
      const parentVersionId = currentReferenceNumber > 1 ? currentReferenceId : null;
      currentReferenceId = currentReferenceNumber === 1 ? REFERENCE_V1 : REFERENCE_V2;
      if (failFirstReference && referenceGenerationCount === 1) {
        pipeline = {
          ...pipeline,
          projectStatus: 'FAILED',
          referenceVersions: [...pipeline.referenceVersions, makeReferenceVersion({ status: 'FAILED', versionId: currentReferenceId, versionNumber: currentReferenceNumber, parentVersionId })],
          jobs: [{ jobId: JOB_REFERENCE, stage: 'REFERENCE_IMAGE', status: 'FAILED', safeErrorCode: 'REFERENCE_TIMEOUT', attemptCount: 1, createdAt: STAMP, updatedAt: STAMP }],
        };
        return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ jobId: JOB_REFERENCE, versionId: currentReferenceId, projectStatus: 'REFERENCES_QUEUED' }) });
      }
      if (progressReferences && referenceGenerationCount === 1) {
        const generatingVersion = makeReferenceVersion({ status: 'GENERATING', versionId: currentReferenceId, versionNumber: currentReferenceNumber, parentVersionId });
        const queuedJob = { jobId: JOB_REFERENCE, stage: 'REFERENCE_IMAGE', status: 'PENDING', safeErrorCode: null, attemptCount: 1, createdAt: STAMP, updatedAt: STAMP };
        const processingJob = { ...queuedJob, status: 'PROCESSING' };
        const queuedPipeline = { ...pipeline, projectStatus: 'REFERENCES_QUEUED', referenceVersions: [...pipeline.referenceVersions, generatingVersion], jobs: [queuedJob] };
        const processingPipeline = { ...pipeline, projectStatus: 'REFERENCES_GENERATING', referenceVersions: [...pipeline.referenceVersions, generatingVersion], jobs: [processingJob] };
        const reviewPipeline = { ...pipeline, projectStatus: 'REFERENCES_REVIEW', referenceVersions: [...pipeline.referenceVersions, makeReferenceVersion({ status: 'READY_FOR_REVIEW', views: ['front', 'left', 'right', 'back'], versionId: currentReferenceId, versionNumber: currentReferenceNumber, parentVersionId })], jobs: [{ ...queuedJob, status: 'COMPLETED' }] };
        pipeline = reviewPipeline;
        referenceSnapshots = [queuedPipeline, processingPipeline, reviewPipeline];
        return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ jobId: JOB_REFERENCE, versionId: currentReferenceId, projectStatus: 'REFERENCES_QUEUED' }) });
      }
      pipeline = {
        ...pipeline,
        projectStatus: 'REFERENCES_REVIEW',
        referenceVersions: [
          ...pipeline.referenceVersions,
          makeReferenceVersion({ status: 'READY_FOR_REVIEW', views: ['front', 'left', 'right', 'back'], versionId: currentReferenceId, versionNumber: currentReferenceNumber, parentVersionId }),
        ],
        jobs: [{ jobId: JOB_REFERENCE, stage: 'REFERENCE_IMAGE', status: 'COMPLETED', safeErrorCode: null, attemptCount: 1, createdAt: STAMP, updatedAt: STAMP }],
      };
      return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ jobId: JOB_REFERENCE, versionId: currentReferenceId, projectStatus: 'REFERENCES_QUEUED' }) });
    }
    const referenceApprovalMatch = path.match(new RegExp(`^/api/ai-studio/projects/${PROJECT_ID}/references/(${REFERENCE_V1}|${REFERENCE_V2})/approval$`));
    if (referenceApprovalMatch && request.method() === 'POST') {
      referenceApprovalDecision = request.postDataJSON().decision;
      const targetVersionId = referenceApprovalMatch[1];
      pipeline = { ...pipeline, projectStatus: referenceApprovalDecision === 'APPROVED' ? 'REFERENCES_APPROVED' : 'REFERENCES_REVIEW', referenceVersions: pipeline.referenceVersions.map(version => version.versionId === targetVersionId ? { ...version, status: referenceApprovalDecision } : version) };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ approvalId: APPROVAL_REFERENCE, projectStatus: pipeline.projectStatus, versionStatus: referenceApprovalDecision }) });
    }
    const referenceViewMatch = path.match(new RegExp(`^/api/ai-studio/projects/${PROJECT_ID}/references/(${REFERENCE_V1}|${REFERENCE_V2})/views/(front|left|right|back)$`));
    if (referenceViewMatch && request.method() === 'GET') return route.fulfill({ status: 200, contentType: 'image/png', body: referenceImage });
    if (path === `/api/ai-studio/projects/${PROJECT_ID}/models/generate` && request.method() === 'POST') {
      const command = request.postDataJSON();
      pipeline = {
        ...pipeline,
        projectStatus: 'MODEL_REVIEW',
        modelVersions: [{ modelVersionId: MODEL_V1, versionNumber: 1, referenceVersionId: command.referenceVersionId, status: 'READY_FOR_REVIEW', supersedesModelVersionId: null, artifactAvailable: true, createdAt: STAMP }],
        jobs: [...pipeline.jobs, { jobId: JOB_MODEL, stage: 'MODEL_MESH', status: 'COMPLETED', safeErrorCode: null, attemptCount: 1, createdAt: STAMP, updatedAt: STAMP }],
      };
      return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ jobId: JOB_MODEL, versionId: MODEL_V1, projectStatus: 'MODEL_QUEUED' }) });
    }
    const artifactMatch = path.match(new RegExp(`^/api/ai-studio/projects/${PROJECT_ID}/models/(${MODEL_V1}|${MODEL_V2})/artifact$`));
    if (artifactMatch && request.method() === 'GET') {
      if (onModelArtifact) return onModelArtifact(route, request);
      return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: model });
    }
    const readinessMatch = path.match(new RegExp(`^/api/ai-studio/projects/${PROJECT_ID}/models/(${MODEL_V1}|${MODEL_V2})/print-readiness$`));
    if (readinessMatch && request.method() === 'GET') {
      const modelVersionId = readinessMatch[1];
      const responseIndex = readinessResponseCount++;
      if (onPrintReadiness) return onPrintReadiness(route, request, responseIndex);
      const configured = printReadinessResponses[responseIndex];
      if (typeof configured === 'number' && configured !== 200) {
        return route.fulfill({ status: configured, contentType: 'application/json', body: JSON.stringify({ code: `TEST_ONLY_${configured}` }) });
      }
      const modelVersion = pipeline.modelVersions.find(version => version.modelVersionId === modelVersionId);
      const isApproved = pipeline.projectStatus === 'COMPLETED' && modelVersion?.status === 'APPROVED';
      const response = isApproved ? {
        projectId: PROJECT_ID, modelVersionId, projectStatus: 'COMPLETED', modelStatus: 'APPROVED',
        artifactAvailable: true, artifactSha256: modelSha256, printReadiness: 'READY', reasonCode: null,
        xMm: 42.25, yMm: 28.5, zMm: 12.125, dimensionUnit: 'mm', dimensionSource: 'TRUSTED_MEASUREMENT',
        dimensionMethod: 'MESH_TRIANGLE_SURFACE_V1', measurementModelVersionId: modelVersionId,
        measurementArtifactSha256: modelSha256, measuredAt: STAMP, provenanceId: 'measurement-verified-1',
      } : {
        projectId: PROJECT_ID, modelVersionId, projectStatus: pipeline.projectStatus, modelStatus: modelVersion?.status || 'READY_FOR_REVIEW',
        artifactAvailable: true, artifactSha256: modelSha256, printReadiness: 'NOT_READY', reasonCode: 'MODEL_NOT_APPROVED',
        xMm: null, yMm: null, zMm: null, dimensionUnit: 'mm', dimensionSource: null, dimensionMethod: null,
        measurementModelVersionId: null, measurementArtifactSha256: null, measuredAt: null, provenanceId: null,
      };
      if (configured && typeof configured === 'object') Object.assign(response, configured);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    }
    if (path === `/api/ai-studio/projects/${PROJECT_ID}/models/${MODEL_V1}/approval` && request.method() === 'POST') {
      modelApprovalDecision = request.postDataJSON().decision;
      pipeline = { ...pipeline, projectStatus: modelApprovalDecision === 'APPROVED' ? 'COMPLETED' : 'MODEL_REVIEW', modelVersions: [{ ...pipeline.modelVersions[0], status: modelApprovalDecision }] };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ approvalId: APPROVAL_MODEL, projectStatus: pipeline.projectStatus, versionStatus: modelApprovalDecision }) });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY_NOT_FOUND' }) });
  });
  return { calls, getReferenceApprovalDecision: () => referenceApprovalDecision, getModelApprovalDecision: () => modelApprovalDecision };
}

test('Design Project review unlocks print preparation only after READY provenance matches the verified model', async ({ page }) => {
  await installSession(page);
  const api = await installWorkflowApi(page);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Design Pipeline' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo ảnh tham chiếu' })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  await expect(page.getByRole('button', { name: 'Duyệt ảnh tham chiếu' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Ảnh tham chiếu front' })).toBeVisible();
  await page.getByRole('button', { name: 'Duyệt ảnh tham chiếu' }).click();
  await expect(page.getByRole('button', { name: 'Tạo model 3D' })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo model 3D' }).click();
  await expect(page.getByText('Artifact GLB đã parse, có mesh hình học hợp lệ và tải thành công trong Viewer.')).toBeVisible();
  await expect(page.locator('.ai-studio__stage-content canvas')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Artifact GLB đã parse, có mesh hình học hợp lệ và tải thành công trong Viewer.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Duyệt model' })).toBeVisible();
  await page.getByRole('button', { name: 'Duyệt model' }).click();
  await expect(page.getByText('Backend xác nhận model đã duyệt và dự án đã hoàn tất.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' })).toBeEnabled();
  await expect(page.getByText(/Nguồn: TRUSTED_MEASUREMENT.*Bằng chứng: measurement-verified-1/)).toBeVisible();
  await page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' }).click();
  await expect(page).toHaveURL(/\/print-quote$/);
  await expect(page.getByText('Kích thước gốc do Backend xác nhận: READY')).toBeVisible();
  await expect(page.getByText('42.25 × 28.5 × 12.125 mm')).toHaveCount(2);
  await expect(page.getByText(/Provenance: measurement-verified-1/)).toBeVisible();
  await expect(page.getByText(/Không tạo báo giá hoặc xác nhận khả năng in/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.print-quote__viewer canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const commands = api.calls.filter(call => call.method === 'POST' && /references\/generate|\/approval|models\/generate/.test(call.path));
  expect(commands).toHaveLength(4);
  expect(commands.every(command => command.idempotencyKey.length > 0)).toBe(true);
  expect(commands[0].body).toEqual({ viewSlot: null, revisionFeedback: null });
  expect(commands[1].body).toEqual({ decision: 'APPROVED', feedback: '' });
  expect(commands[2].body).toEqual({ referenceVersionId: REFERENCE_V1, revisionFeedback: null });
  expect(commands[3].body).toEqual({ decision: 'APPROVED', feedback: '' });
  expect(api.getReferenceApprovalDecision()).toBe('APPROVED');
  expect(api.getModelApprovalDecision()).toBe('APPROVED');
  expect(api.calls.some(call => call.path.includes('/generations') && call.method === 'POST')).toBe(false);
  expect(api.calls.some(call => call.method === 'GET' && call.path.endsWith('/print-readiness'))).toBe(true);
  expect(api.calls.some(call => /pricing|quote\/calculate/i.test(call.path))).toBe(false);
  expect(api.calls.some(call => call.path.endsWith('/artifact') && call.method === 'GET')).toBe(true);
});

test('NOT_READY never unlocks print preparation and retry rereads the Backend endpoint', async ({ page }) => {
  await installSession(page);
  const api = await installWorkflowApi(page, {
    initialApprovedModel: true,
    printReadinessResponses: [{
      printReadiness: 'NOT_READY', reasonCode: 'MEASUREMENT_UNAVAILABLE', xMm: null, yMm: null, zMm: null,
      dimensionSource: null, dimensionMethod: null, measurementModelVersionId: null,
      measurementArtifactSha256: null, measuredAt: null, provenanceId: null,
    }],
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  const prepare = page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' });
  await expect(page.getByText(/reasonCode: MEASUREMENT_UNAVAILABLE/)).toBeVisible();
  await expect(prepare).toBeDisabled();
  await page.getByRole('button', { name: 'Kiểm tra lại Print Readiness' }).click();
  await expect(prepare).toBeEnabled();
  expect(api.calls.filter(call => call.method === 'GET' && call.path.endsWith('/print-readiness')).length).toBeGreaterThanOrEqual(2);
});

test('401, 403 and 404 Print Readiness responses stay locked and can be retried', async ({ page }) => {
  await installSession(page);
  const api = await installWorkflowApi(page, { initialApprovedModel: true, printReadinessResponses: [401, 403, 404] });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  const prepare = page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' });
  await expect(page.getByText(/Phiên đăng nhập cần được xác thực lại/)).toBeVisible();
  await expect(prepare).toBeDisabled();
  await page.getByRole('button', { name: 'Kiểm tra lại Print Readiness' }).click();
  await expect(page.getByText(/không có quyền đọc điều kiện/)).toBeVisible();
  await expect(prepare).toBeDisabled();
  await page.getByRole('button', { name: 'Kiểm tra lại Print Readiness' }).click();
  await expect(page.getByText(/không còn khả dụng để kiểm tra/)).toBeVisible();
  await expect(prepare).toBeDisabled();
  await page.getByRole('button', { name: 'Kiểm tra lại Print Readiness' }).click();
  await expect(prepare).toBeEnabled();
  expect(api.calls.filter(call => call.method === 'GET' && call.path.endsWith('/print-readiness'))).toHaveLength(4);
});

test('incomplete, wrong-version and wrong-measurement digest DTOs fail closed', async ({ page }) => {
  await installSession(page);
  await installWorkflowApi(page, {
    initialApprovedModel: true,
    printReadinessResponses: [
      { modelVersionId: REFERENCE_V1 },
      { provenanceId: null },
      { measurementArtifactSha256: '0'.repeat(64) },
    ],
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  const prepare = page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' });
  for (let index = 0; index < 3; index += 1) {
    await expect(page.getByText(/không đầy đủ hoặc không khớp version\/digest/)).toBeVisible();
    await expect(prepare).toBeDisabled();
    await page.getByRole('button', { name: 'Kiểm tra lại Print Readiness' }).click();
  }
  await expect(prepare).toBeEnabled();
});

test('downloaded GLB digest must match the Backend readiness digest', async ({ page }) => {
  await installSession(page);
  await installWorkflowApi(page, {
    initialApprovedModel: true,
    onModelArtifact: route => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: glbV2([0, 0, 0, 2, 0, 0, 0, 2, 0]) }),
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await expect(page.getByText(/Digest artifact tải về không khớp/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' })).toBeDisabled();
});

test('Print Readiness is fetched again after reload', async ({ page }) => {
  await installSession(page);
  const api = await installWorkflowApi(page, { initialApprovedModel: true });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await expect(page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' })).toBeEnabled();
  const beforeReload = api.calls.filter(call => call.method === 'GET' && call.path.endsWith('/print-readiness')).length;
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' })).toBeEnabled();
  expect(api.calls.filter(call => call.method === 'GET' && call.path.endsWith('/print-readiness')).length).toBeGreaterThan(beforeReload);
});

test('Print Quote revalidates READY on entry, refresh and browser back/forward', async ({ page }) => {
  await installSession(page);
  const api = await installWorkflowApi(page, { initialApprovedModel: true });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' }).click();
  await expect(page.getByText('Kích thước gốc do Backend xác nhận: READY')).toBeVisible();
  const countReadiness = () => api.calls.filter(call => call.method === 'GET' && call.path.endsWith('/print-readiness')).length;
  const entryCount = countReadiness();
  expect(api.calls.filter(call => call.method === 'GET' && call.path.endsWith('/artifact')).length).toBeGreaterThanOrEqual(2);
  await page.reload();
  await expect(page.getByText('Kích thước gốc do Backend xác nhận: READY')).toBeVisible();
  expect(countReadiness()).toBeGreaterThan(entryCount);
  const reloadCount = countReadiness();
  await page.goBack();
  await expect(page).toHaveURL(/\/studio\?/);
  await page.goForward();
  await expect(page.getByText('Kích thước gốc do Backend xác nhận: READY')).toBeVisible();
  expect(countReadiness()).toBeGreaterThan(reloadCount);
});

test('tampered route-state dimensions cannot override the revalidated Backend snapshot', async ({ page }) => {
  await page.addInitScript(() => {
    const originalPushState = history.pushState.bind(history);
    history.pushState = (data, unused, url) => {
      if (String(url || '').includes('/print-quote') && data?.usr?.printDraft) {
        data.usr.printDraft.dimensions = { x: 999, y: 28.5, z: 12.125 };
      }
      return originalPushState(data, unused, url);
    };
  });
  await installSession(page);
  const api = await installWorkflowApi(page, { initialApprovedModel: true });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' }).click();
  await expect(page.getByRole('heading', { name: 'Chưa thể chuẩn bị cấu hình in' })).toBeVisible();
  await expect(page.getByText('Kích thước gốc do Backend xác nhận: READY')).toHaveCount(0);
  await expect(page.getByText('42.25 × 28.5 × 12.125 mm')).toHaveCount(0);
  await expect(page.getByText(/Provenance:/)).toHaveCount(0);
  expect(api.calls.filter(call => call.method === 'GET' && call.path.endsWith('/print-readiness')).length).toBeGreaterThanOrEqual(2);
});

test('Print Quote hides prior READY evidence when Backend changes to NOT_READY', async ({ page }) => {
  await installSession(page);
  const api = await installWorkflowApi(page, {
    initialApprovedModel: true,
    printReadinessResponses: [undefined, {
      printReadiness: 'NOT_READY', reasonCode: 'MEASUREMENT_REVOKED', xMm: null, yMm: null, zMm: null,
      dimensionSource: null, dimensionMethod: null, measurementModelVersionId: null,
      measurementArtifactSha256: null, measuredAt: null, provenanceId: null,
    }],
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' }).click();
  await expect(page.getByRole('heading', { name: 'Chưa thể chuẩn bị cấu hình in' })).toBeVisible();
  await expect(page.getByText(/MEASUREMENT_REVOKED/)).toBeVisible();
  await expect(page.getByText('Kích thước gốc do Backend xác nhận: READY')).toHaveCount(0);
  await expect(page.getByText(/Provenance:/)).toHaveCount(0);
  expect(api.calls.filter(call => call.method === 'GET' && call.path.endsWith('/print-readiness'))).toHaveLength(2);
});

test('Print Quote fails closed for Backend errors, logout and account change', async ({ page }) => {
  const readyDigest = createHash('sha256').update(glbV2()).digest('hex');
  await page.addInitScript(({ projectId, modelVersionId, digest }) => {
    history.replaceState({
      usr: { printDraft: {
        projectId, modelVersionId, printReadiness: 'READY', artifactSha256: digest,
        dimensions: { x: 42.25, y: 28.5, z: 12.125 }, dimensionSource: 'TRUSTED_MEASUREMENT',
        dimensionMethod: 'MESH_TRIANGLE_SURFACE_V1', measurementModelVersionId: modelVersionId,
        measurementArtifactSha256: digest, measuredAt: '2026-11-18T10:00:00Z', provenanceId: 'measurement-verified-1',
        modelUrl: `/api/ai-studio/projects/${projectId}/models/${modelVersionId}/artifact#design-model.glb`, format: 'glb',
      } }, key: 'print-quote-auth-test', idx: 0,
    }, '', location.href);
  }, { projectId: PROJECT_ID, modelVersionId: MODEL_V1, digest: readyDigest });
  await installSession(page);
  const api = await installWorkflowApi(page, {
    onPrintReadiness: (route, request, index) => {
      if (request.headers()['authorization']?.endsWith('WORKFLOW_B')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"NOT_FOUND"}' });
      if (index === 0) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"code":"UNAUTHORIZED"}' });
      if (index === 1) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"code":"FORBIDDEN"}' });
      if (index === 2) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"NOT_FOUND"}' });
      if (index === 3) return route.abort('failed');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        projectId: PROJECT_ID, modelVersionId: MODEL_V1, projectStatus: 'COMPLETED', modelStatus: 'APPROVED',
        artifactAvailable: true, artifactSha256: readyDigest, printReadiness: 'READY', reasonCode: null,
        xMm: 42.25, yMm: 28.5, zMm: 12.125, dimensionUnit: 'mm', dimensionSource: 'TRUSTED_MEASUREMENT',
        dimensionMethod: 'MESH_TRIANGLE_SURFACE_V1', measurementModelVersionId: MODEL_V1,
        measurementArtifactSha256: readyDigest, measuredAt: STAMP, provenanceId: 'measurement-verified-1',
      }) });
    },
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/print-quote');
  const error = page.getByRole('alert');
  const expectedMessages = [/Không thể xác minh quyền truy cập/, /Không thể xác minh quyền truy cập/, /Không thể xác minh quyền truy cập/, /Không thể xác minh dữ liệu chuẩn bị in/];
  for (const [index, expectedMessage] of expectedMessages.entries()) {
    await expect(error).toContainText(expectedMessage);
    await expect(page.getByText(/Provenance:/)).toHaveCount(0);
    if (index < expectedMessages.length - 1) await page.getByRole('button', { name: 'Thử lại' }).click();
  }
  await page.getByRole('button', { name: 'Tài khoản' }).click();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Provenance:/)).toHaveCount(0);
  await page.goBack();
  await expect(page.getByText(/Đăng nhập để xác minh dữ liệu dự án/)).toBeVisible();
  await expect(page.getByText(/Provenance:/)).toHaveCount(0);
  await page.evaluate(() => {
    const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.WORKFLOW_B`;
    localStorage.setItem('morphia_access_token', token);
    localStorage.setItem('morphia_user', JSON.stringify({ id: 'workflow-user-b', email: 'b@example.invalid', token }));
  });
  await page.reload();
  await expect(page.getByText(/Không thể xác minh quyền truy cập/)).toBeVisible();
  await expect(page.getByText(/Provenance:/)).toHaveCount(0);
  expect(api.calls.some(call => call.method === 'GET' && call.path.endsWith('/print-readiness'))).toBe(true);
});

test('Print Quote rejects a GLB whose bytes differ from the Backend READY digest', async ({ page }) => {
  await installSession(page);
  let artifactRequestCount = 0;
  await installWorkflowApi(page, {
    initialApprovedModel: true,
    onModelArtifact: route => {
      artifactRequestCount += 1;
      return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: artifactRequestCount === 1 ? glbV2() : glbV2([0, 0, 0, 3, 0, 0, 0, 3, 0]) });
    },
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' }).click();
  await expect(page.getByRole('heading', { name: 'Chưa thể chuẩn bị cấu hình in' })).toBeVisible();
  await expect(page.getByText(/Tệp mô hình không khớp với digest/)).toBeVisible();
  await expect(page.locator('.print-quote__viewer canvas')).toHaveCount(0);
  await expect(page.getByText(/Provenance:/)).toHaveCount(0);
});

test('legacy generation Print Quote draft still opens its local configuration without Design Project readiness', async ({ page }) => {
  await page.addInitScript(() => history.replaceState({
    usr: { printDraft: {
      id: 'legacy-generation-1', title: 'Legacy generation model', productName: 'Legacy generation model',
      modelUrl: '/legacy-model.glb#model.glb', format: 'glb', dimensions: '20 x 10 x 5 mm',
    } }, key: 'legacy-print-quote', idx: 0,
  }, '', location.href));
  await installSession(page);
  const api = await installWorkflowApi(page);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/print-quote');
  await expect(page.getByRole('heading', { name: 'Legacy generation model' })).toBeVisible();
  await expect(page.getByText('Kích thước nhận từ AI Studio')).toBeVisible();
  await expect(page.getByLabel('Chiều X')).toHaveValue('20');
  expect(api.calls.some(call => call.method === 'GET' && call.path.endsWith('/print-readiness'))).toBe(false);
});

test('stale Print Readiness from a prior model version cannot replace the selected version result', async ({ page }) => {
  await installSession(page);
  let releaseOldResponse;
  let signalOldResponse;
  const oldRequestStarted = new Promise(resolve => { signalOldResponse = resolve; });
  const oldResponsePending = new Promise(resolve => { releaseOldResponse = resolve; });
  const modelSha256 = createHash('sha256').update(glbV2()).digest('hex');
  await installWorkflowApi(page, {
    initialApprovedModel: true,
    initialModelVersions: 2,
    onPrintReadiness: async (route, request) => {
      if (request.url().includes(MODEL_V2)) {
        signalOldResponse();
        await oldResponsePending;
        try {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            projectId: PROJECT_ID, modelVersionId: MODEL_V2, projectStatus: 'COMPLETED', modelStatus: 'APPROVED',
            artifactAvailable: true, artifactSha256: modelSha256, printReadiness: 'NOT_READY', reasonCode: 'STALE_VERSION',
            xMm: null, yMm: null, zMm: null,
          }) });
        } catch { /* The selection change aborts the stale request. */ }
        return;
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        projectId: PROJECT_ID, modelVersionId: MODEL_V1, projectStatus: 'COMPLETED', modelStatus: 'APPROVED',
        artifactAvailable: true, artifactSha256: modelSha256, printReadiness: 'READY', reasonCode: null,
        xMm: 42.25, yMm: 28.5, zMm: 12.125, dimensionUnit: 'mm', dimensionSource: 'TRUSTED_MEASUREMENT',
        dimensionMethod: 'MESH_TRIANGLE_SURFACE_V1', measurementModelVersionId: MODEL_V1,
        measurementArtifactSha256: modelSha256, measuredAt: STAMP, provenanceId: 'measurement-v1',
      }) });
    },
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await oldRequestStarted;
  await page.getByRole('combobox', { name: 'Phiên bản model' }).selectOption(MODEL_V1);
  await expect(page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' })).toBeEnabled();
  releaseOldResponse();
  await expect(page.getByText(/Bằng chứng: measurement-v1/)).toBeVisible();
  await expect(page.getByText(/STALE_VERSION/)).toHaveCount(0);
});

test('stale Print Readiness response is hidden after an account change', async ({ page }) => {
  await installSession(page);
  let releaseOldResponse;
  let signalOldResponse;
  const oldRequestStarted = new Promise(resolve => { signalOldResponse = resolve; });
  const oldResponsePending = new Promise(resolve => { releaseOldResponse = resolve; });
  const api = await installWorkflowApi(page, {
    initialApprovedModel: true,
    onPrintReadiness: async route => {
      signalOldResponse();
      await oldResponsePending;
      try {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ printReadiness: 'READY', provenanceId: 'stale-owner-private' }) });
      } catch { /* The account change aborts the stale request. */ }
    },
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await oldRequestStarted;
  await page.evaluate(() => {
    const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.WORKFLOW_B`;
    localStorage.setItem('morphia_access_token', token);
    localStorage.setItem('morphia_user', JSON.stringify({ id: 'workflow-user-b', email: 'b@example.invalid', token }));
  });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Design Project actions' })).toHaveCount(0);
  releaseOldResponse();
  await expect(page.getByText('stale-owner-private')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' })).toHaveCount(0);
  expect(api.calls.some(call => call.path.endsWith('/print-readiness'))).toBe(true);
});

test('stale Print Readiness response is hidden after opening a different project', async ({ page }) => {
  await installSession(page);
  let releaseOldResponse;
  let signalOldResponse;
  const oldRequestStarted = new Promise(resolve => { signalOldResponse = resolve; });
  const oldResponsePending = new Promise(resolve => { releaseOldResponse = resolve; });
  await installWorkflowApi(page, {
    initialApprovedModel: true,
    onPrintReadiness: async route => {
      signalOldResponse();
      await oldResponsePending;
      try {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ printReadiness: 'READY', provenanceId: 'stale-project-private' }) });
      } catch { /* The project change aborts the stale request. */ }
    },
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await oldRequestStarted;
  await page.evaluate(projectId => {
    history.pushState({}, '', `/studio?projectId=${projectId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, '99999999-9999-4999-8999-999999999999');
  await expect(page).toHaveURL(/projectId=99999999-9999-4999-8999-999999999999/);
  await expect(page.getByRole('region', { name: 'Design Project actions' })).toHaveCount(0);
  releaseOldResponse();
  await expect(page.getByText('stale-project-private')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở chuẩn bị cấu hình in' })).toHaveCount(0);
});

test('reference generation visibly progresses from queued through processing to review', async ({ page }) => {
  await installSession(page);
  const api = await installWorkflowApi(page, { progressReferences: true });
  await page.clock.install({ time: new Date('2026-11-18T10:00:00Z') });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  const stepper = page.getByRole('list', { name: 'Tiến trình AI Studio' });
  await expect(stepper.getByText('Backend đang tạo ảnh tham chiếu.')).toBeVisible();
  await page.clock.fastForward(8_000);
  await expect(stepper.getByText('Backend đang tạo ảnh tham chiếu.')).toBeVisible();
  await page.clock.fastForward(8_000);
  await expect(page.getByRole('button', { name: 'Duyệt ảnh tham chiếu' })).toBeVisible();
  expect(api.calls.filter(call => call.path.endsWith('/pipeline') && call.method === 'GET').length).toBeGreaterThanOrEqual(4);
});

test('failed reference job offers a backend retry with a fresh idempotency key', async ({ page }) => {
  await installSession(page);
  const api = await installWorkflowApi(page, { failFirstReference: true });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  await expect(page.getByRole('button', { name: 'Thử lại tạo ảnh tham chiếu' })).toBeVisible();
  await page.getByRole('button', { name: 'Thử lại tạo ảnh tham chiếu' }).click();
  await expect(page.getByRole('button', { name: 'Duyệt ảnh tham chiếu' })).toBeVisible();
  const retries = api.calls.filter(call => call.method === 'POST' && call.path.endsWith('/references/generate'));
  expect(retries).toHaveLength(2);
  expect(retries[0].idempotencyKey).not.toBe(retries[1].idempotencyKey);
  expect(retries[1].body).toEqual({ viewSlot: null, revisionFeedback: null });
});

test('network uncertainty retry reuses the original idempotency key', async ({ page }) => {
  await installSession(page);
  const api = await installWorkflowApi(page, { uncertainFirstReference: true });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Mất kết nối trước khi xác nhận thao tác.' })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  await expect(page.getByRole('button', { name: 'Duyệt ảnh tham chiếu' })).toBeVisible();
  const retries = api.calls.filter(call => call.method === 'POST' && call.path.endsWith('/references/generate'));
  expect(retries).toHaveLength(2);
  expect(retries[0].idempotencyKey).not.toBe('');
  expect(retries[0].idempotencyKey).toBe(retries[1].idempotencyKey);
});

test('reference changes request creates a Backend revision from the selected view and feedback', async ({ page }) => {
  await installSession(page);
  const api = await installWorkflowApi(page);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  await page.getByLabel('Phản hồi duyệt ảnh (không bắt buộc)').fill('Please revise the front view.');
  await page.getByRole('button', { name: 'Yêu cầu chỉnh sửa' }).click();
  await expect(page.getByLabel('Góc cần chỉnh sửa')).toBeVisible();
  await page.getByLabel('Nội dung chỉnh sửa').fill('Make the front silhouette wider.');
  await page.getByRole('button', { name: 'Tạo revision ảnh' }).click();
  await expect(page.getByRole('combobox', { name: 'Phiên bản ảnh tham chiếu' })).toHaveValue(REFERENCE_V2);
  await expect(page.getByRole('button', { name: 'Duyệt ảnh tham chiếu' })).toBeVisible();

  const commands = api.calls.filter(call => call.method === 'POST' && /references\/generate|\/approval/.test(call.path));
  expect(commands).toHaveLength(3);
  expect(commands[0].body).toEqual({ viewSlot: null, revisionFeedback: null });
  expect(commands[1].body).toEqual({ decision: 'CHANGES_REQUESTED', feedback: 'Please revise the front view.' });
  expect(commands[2].body).toEqual({ viewSlot: 'front', revisionFeedback: 'Make the front silhouette wider.' });
  expect(commands.every(command => command.idempotencyKey.length > 0)).toBe(true);
});

test('a pending workflow mutation from one account cannot reveal its response after owner change', async ({ page }) => {
  await installSession(page);
  let releaseCommand;
  let signalCommand;
  const commandStarted = new Promise(resolve => { signalCommand = resolve; });
  const pendingCommand = new Promise(resolve => { releaseCommand = resolve; });
  const api = await installWorkflowApi(page, { onGenerateReference: async route => {
    signalCommand();
    await pendingCommand;
    try {
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ jobId: JOB_REFERENCE, versionId: REFERENCE_V1, projectStatus: 'REFERENCES_QUEUED' }) });
    } catch { /* The owner change aborts this request. */ }
  } });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  await commandStarted;
  await page.evaluate(() => {
    const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.WORKFLOW_B`;
    localStorage.setItem('morphia_access_token', token);
    localStorage.setItem('morphia_user', JSON.stringify({ id: 'workflow-user-b', email: 'b@example.invalid', token }));
  });
  await page.reload();
  await expect(page.getByText('Workflow fixture project')).toHaveCount(0);
  releaseCommand();
  await page.waitForTimeout(50);
  await expect(page.getByText(JOB_REFERENCE)).toHaveCount(0);
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1);
});

test('a pending workflow mutation cannot carry project data into a different project route', async ({ page }) => {
  await installSession(page);
  let releaseCommand;
  let signalCommand;
  const commandStarted = new Promise(resolve => { signalCommand = resolve; });
  const pendingCommand = new Promise(resolve => { releaseCommand = resolve; });
  const api = await installWorkflowApi(page, { onGenerateReference: async route => {
    signalCommand();
    await pendingCommand;
    try {
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ jobId: JOB_REFERENCE, versionId: REFERENCE_V1, projectStatus: 'REFERENCES_QUEUED' }) });
    } catch { /* The project change aborts this request. */ }
  } });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  await commandStarted;
  await page.evaluate(projectId => {
    history.pushState({}, '', `/studio?projectId=${projectId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, '99999999-9999-4999-8999-999999999999');
  await expect(page).toHaveURL(/projectId=99999999-9999-4999-8999-999999999999/);
  await expect(page.getByLabel('Chi tiết dự án đang mở')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Design Project actions' })).toHaveCount(0);
  releaseCommand();
  await page.waitForTimeout(50);
  await expect(page.getByText(JOB_REFERENCE)).toHaveCount(0);
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1);
});

test('an invalid model artifact stays out of the Viewer and blocks model approval', async ({ page }) => {
  await installSession(page);
  const api = await installWorkflowApi(page, { onModelArtifact: route => route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.from('not-a-glb') }) });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  await page.getByRole('button', { name: 'Duyệt ảnh tham chiếu' }).click();
  await page.getByRole('button', { name: 'Tạo model 3D' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Artifact từ Backend không phải GLB v2 hợp lệ' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Duyệt model' })).toHaveCount(0);
  await expect(page.locator('[data-testid="design-project-model-viewer"]')).toHaveCount(0);
  await expect(page.locator('.ai-studio__stage-content canvas')).toHaveCount(0);
  expect(api.calls.some(call => call.path.endsWith('/artifact') && call.method === 'GET')).toBe(true);
});

test('a missing model artifact is reported and cannot be approved', async ({ page }) => {
  await installSession(page);
  const api = await installWorkflowApi(page, { onModelArtifact: route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_ONLY_NOT_FOUND' }) }) });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  await page.getByRole('button', { name: 'Duyệt ảnh tham chiếu' }).click();
  await page.getByRole('button', { name: 'Tạo model 3D' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa tải được artifact GLB từ Backend.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Duyệt model' })).toHaveCount(0);
  await expect(page.locator('[data-testid="design-project-model-viewer"]')).toHaveCount(0);
  expect(api.calls.some(call => call.path.endsWith('/artifact') && call.method === 'GET')).toBe(true);
});

test('MIME-valid corrupt reference bytes block approval', async ({ page }) => {
  await installSession(page);
  await installWorkflowApi(page, { invalidReferenceBytes: true });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  await expect(page.getByText('Một hoặc nhiều ảnh tham chiếu chưa thể đọc an toàn.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Duyệt ảnh tham chiếu' })).toHaveCount(0);
});

test('reference SHA-256 mismatch against version and slot metadata blocks approval', async ({ page }) => {
  await installSession(page);
  await installWorkflowApi(page, { mismatchReferenceHash: true });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  await expect(page.getByText('Một hoặc nhiều ảnh tham chiếu chưa thể đọc an toàn.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Duyệt ảnh tham chiếu' })).toHaveCount(0);
});

test('GLB with a valid header but degenerate mesh geometry cannot be approved', async ({ page }) => {
  await installSession(page);
  await installWorkflowApi(page, { onModelArtifact: route => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: glbV2([0, 0, 0, 0, 0, 0, 0, 0, 0]) }) });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`/studio?projectId=${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Tạo ảnh tham chiếu' }).click();
  await page.getByRole('button', { name: 'Duyệt ảnh tham chiếu' }).click();
  await page.getByRole('button', { name: 'Tạo model 3D' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Artifact từ Backend không phải GLB v2 hợp lệ' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Duyệt model' })).toHaveCount(0);
});
