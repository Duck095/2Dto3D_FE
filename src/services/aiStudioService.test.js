import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import axiosClient from './api/apiClient.js';
import {
    approveAIStudioProjectModel,
    approveAIStudioProjectReference,
    createAIStudioProject,
    generateAIStudioProjectModel,
    generateAIStudioProjectReferences,
    getAIStudioProject,
    getAIStudioProjectInputContent,
    getAIStudioProjectHistory,
    getAIStudioProjectModelArtifact,
    getAIStudioProjectModelPrintReadiness,
    getAIStudioProjectPipeline,
    getAIStudioProjectReferenceView,
    getAIStudioProjectTimeline,
} from './aiStudioService.js';

const service = await readFile(new URL('./aiStudioService.js', import.meta.url), 'utf8');
const routes = await readFile(new URL('../config/apiRoutes.js', import.meta.url), 'utf8');
const testStorage = new Map();
const testAccessToken = 'test-ai-studio-access-token';
testStorage.set('morphia_access_token', testAccessToken);
globalThis.localStorage = {
    getItem: (key) => testStorage.get(key) ?? null,
    setItem: (key, value) => testStorage.set(key, String(value)),
    removeItem: (key) => testStorage.delete(key),
};

test('create sends multipart form data and a caller supplied idempotency key', () => {
    assert.ok(service.includes('export async function createAIGeneration(data, image, idempotencyKey, options = {})'));
    assert.ok(service.includes("formData.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))"));
    assert.ok(service.includes("formData.append('image', image)"));
    assert.ok(service.includes("'Content-Type': 'multipart/form-data'"));
    assert.ok(service.includes("'Idempotency-Key': idempotencyKey"));
    assert.ok(service.includes('signal: options.signal'));
    assert.ok(service.includes('API_ROUTES.aiStudio.generations'));
});

test('status, history, result, and retry use the backend generation contract', () => {
    for (const method of ['getAIGeneration', 'getAIGenerationHistory', 'refreshAIGeneration']) {
        assert.ok(service.includes(`export function ${method}(`));
    }
    assert.ok(routes.includes("generation: (id) => `/ai-studio/generations/${id}`"));
    assert.ok(routes.includes("generationHistory: '/ai-studio/generations/history'"));
    assert.ok(routes.includes("retryGeneration: (id) => `/ai-studio/generations/${id}/retry`"));
    assert.ok(routes.includes("generationResult: (id) => `/ai-studio/generations/${id}/result`"));
    assert.ok(service.includes('params: { page, size }'));
    assert.ok(service.includes("'Idempotency-Key': idempotencyKey"));
});

function responseFor(config, data) {
    return { config, data, headers: {}, status: 200, statusText: 'OK' };
}

test('Design Project sends contract-shaped create, reference, and model requests with authentication', async () => {
    const previousAdapter = axiosClient.defaults.adapter;
    const requests = [];
    axiosClient.defaults.adapter = async (config) => {
        requests.push(config);
        return responseFor(config, { accepted: true });
    };
    const controller = new AbortController();
    const projectId = '6e7d7652-f76c-43da-a36d-880f3ee1e115';
    const referenceVersionId = '19e8f774-89a8-47ba-a621-b6a10badb51c';
    const modelVersionId = '9fa9cc1c-08b5-4619-afca-8716d3c756cc';

    try {
        const images = [
            new Blob(['front-image'], { type: 'image/png' }),
            new Blob(['left-image'], { type: 'image/jpeg' }),
            new Blob(['right-image'], { type: 'image/jpeg' }),
            new Blob(['back-image'], { type: 'image/png' }),
        ];
        const createCases = [
            {
                key: 'create-text-key',
                data: { productType: 'figure', styleId: 'chibi-collectible', inputMode: 'text', originalIdea: 'A small bird figure' },
                images: [],
            },
            {
                key: 'create-image-key',
                data: { productType: 'keychain', keychainVariant: 'ordinary', styleId: 'cute-mascot', inputMode: 'image', originalIdea: 'A bird from the uploaded image' },
                images: images.slice(0, 1),
            },
            {
                key: 'create-multi-key',
                data: { productType: 'night-light', styleId: 'minimalist-glow', inputMode: 'multi', originalIdea: 'A bird-shaped night light' },
                images,
            },
        ];
        for (const createCase of createCases) {
            await createAIStudioProject(createCase.data, createCase.images, createCase.key, { signal: controller.signal });
        }
        await getAIStudioProject(projectId, { signal: controller.signal });
        await getAIStudioProjectPipeline(projectId, { signal: controller.signal });
        const referenceRequest = { viewSlot: 'left', revisionFeedback: 'Show the left side of the object' };
        await generateAIStudioProjectReferences(projectId, referenceRequest, 'refs-key', { signal: controller.signal });
        const referenceApproval = { decision: 'CHANGES_REQUESTED', feedback: 'Rotate the view slightly toward the front' };
        await approveAIStudioProjectReference(projectId, referenceVersionId, referenceApproval, 'ref-approval-key', { signal: controller.signal });
        const modelRequest = { referenceVersionId, revisionFeedback: 'Keep the silhouette compact' };
        await generateAIStudioProjectModel(projectId, modelRequest, 'model-key', { signal: controller.signal });
        const modelApproval = { decision: 'APPROVED', feedback: '' };
        await approveAIStudioProjectModel(projectId, modelVersionId, modelApproval, 'model-approval-key', { signal: controller.signal });
        const imageBlob = new Blob(['private-image']);
        const glbBlob = new Blob(['private-glb']);
        axiosClient.defaults.adapter = async (config) => {
            requests.push(config);
            return responseFor(config, config.url.endsWith('/artifact') ? glbBlob : imageBlob);
        };
        assert.equal(await getAIStudioProjectReferenceView(projectId, referenceVersionId, 'front', { signal: controller.signal }), imageBlob);
        assert.equal(await getAIStudioProjectModelArtifact(projectId, modelVersionId, { signal: controller.signal }), glbBlob);

        const [textCreate, imageCreate, multiCreate, read, pipeline, references, referenceApprovalConfig, model, modelApprovalConfig, view, artifact] = requests;
        const projectPath = `/ai-studio/projects/${projectId}`;
        for (const [create, createCase] of [[textCreate, createCases[0]], [imageCreate, createCases[1]], [multiCreate, createCases[2]]]) {
            assert.equal(create.url, '/ai-studio/projects');
            assert.equal(create.headers.get('Idempotency-Key'), createCase.key);
            assert.equal(create.signal, controller.signal);
            assert.ok(create.data instanceof FormData);
            const dataPart = create.data.get('data');
            assert.equal(dataPart.type, 'application/json');
            assert.deepEqual(JSON.parse(await dataPart.text()), createCase.data);
            assert.deepEqual(await Promise.all(create.data.getAll('images').map((image) => image.text())), await Promise.all(createCase.images.map((image) => image.text())));
        }
        assert.equal(read.url, projectPath);
        assert.equal(pipeline.url, `${projectPath}/pipeline`);
        assert.equal(references.url, `${projectPath}/references/generate`);
        assert.equal(references.headers.get('Idempotency-Key'), 'refs-key');
        assert.deepEqual(JSON.parse(references.data), referenceRequest);
        assert.equal(referenceApprovalConfig.url, `${projectPath}/references/${referenceVersionId}/approval`);
        assert.equal(referenceApprovalConfig.headers.get('Idempotency-Key'), 'ref-approval-key');
        assert.deepEqual(JSON.parse(referenceApprovalConfig.data), referenceApproval);
        assert.equal(model.url, `${projectPath}/models/generate`);
        assert.equal(model.headers.get('Idempotency-Key'), 'model-key');
        assert.deepEqual(JSON.parse(model.data), modelRequest);
        assert.equal(modelApprovalConfig.url, `${projectPath}/models/${modelVersionId}/approval`);
        assert.equal(modelApprovalConfig.headers.get('Idempotency-Key'), 'model-approval-key');
        assert.deepEqual(JSON.parse(modelApprovalConfig.data), modelApproval);
        assert.equal(view.url, `${projectPath}/references/${referenceVersionId}/views/front`);
        assert.equal(view.responseType, 'blob');
        assert.equal(artifact.url, `${projectPath}/models/${modelVersionId}/artifact`);
        assert.equal(artifact.responseType, 'blob');
        assert.ok(requests.every((request) => request.signal === controller.signal));
        assert.ok(requests.every((request) => request.headers.get('Authorization') === `Bearer ${testAccessToken}`));
    } finally {
        axiosClient.defaults.adapter = previousAdapter;
    }
});

test('Design Project requests reject HTTP errors from the shared API client', async () => {
    const previousAdapter = axiosClient.defaults.adapter;
    const httpError = Object.assign(new Error('conflict'), { response: { status: 409 } });
    axiosClient.defaults.adapter = async () => { throw httpError; };
    try {
        await assert.rejects(
            generateAIStudioProjectModel('project-1', {}, 'model-key'),
            (error) => error === httpError,
        );
    } finally {
        axiosClient.defaults.adapter = previousAdapter;
    }
});

test('Design Project source input reads use the authenticated owner-scoped content endpoint', async () => {
    const previousAdapter = axiosClient.defaults.adapter;
    let request;
    const content = new Blob(['verified-image'], { type: 'image/png' });
    axiosClient.defaults.adapter = async (config) => {
        request = config;
        return responseFor(config, content);
    };
    const controller = new AbortController();
    try {
        assert.equal(await getAIStudioProjectInputContent('project/1', 'input/1', { signal: controller.signal }), content);
        assert.equal(request.url, '/ai-studio/projects/project%2F1/inputs/input%2F1/content');
        assert.equal(request.responseType, 'blob');
        assert.equal(request.signal, controller.signal);
        assert.equal(request.headers.get('Authorization'), `Bearer ${testAccessToken}`);
        assert.ok(routes.includes('projectInputContent:'));
    } finally {
        axiosClient.defaults.adapter = previousAdapter;
    }
});

test('Design Project History uses the confirmed paginated route, query and authenticated abort signal', async () => {
    const previousAdapter = axiosClient.defaults.adapter;
    let request;
    axiosClient.defaults.adapter = async (config) => {
        request = config;
        return responseFor(config, { content: [], page: 2, size: 20, totalElements: 40, totalPages: 2, first: false, last: true });
    };
    const controller = new AbortController();
    try {
        const response = await getAIStudioProjectHistory(2, 20, { signal: controller.signal });
        assert.equal(response.page, 2);
        assert.equal(request.url, '/ai-studio/projects');
        assert.deepEqual(request.params, { page: 2, size: 20 });
        assert.equal(request.signal, controller.signal);
        assert.equal(request.headers.get('Authorization'), `Bearer ${testAccessToken}`);
        assert.ok(routes.includes("projects: '/ai-studio/projects'"));
    } finally {
        axiosClient.defaults.adapter = previousAdapter;
    }
});

test('Design Project Timeline uses its confirmed authenticated read route and abort signal', async () => {
    const previousAdapter = axiosClient.defaults.adapter;
    let request;
    axiosClient.defaults.adapter = async (config) => {
        request = config;
        return responseFor(config, { projectId: 'project-1', events: [] });
    };
    const controller = new AbortController();
    try {
        assert.deepEqual(await getAIStudioProjectTimeline('project-1', { signal: controller.signal }), {
            projectId: 'project-1', events: [],
        });
        assert.equal(request.url, '/ai-studio/projects/project-1/timeline');
        assert.equal(request.signal, controller.signal);
        assert.equal(request.headers.get('Authorization'), 'Bearer ' + testAccessToken);
        assert.ok(routes.includes('projectTimeline:'));
    } finally {
        axiosClient.defaults.adapter = previousAdapter;
    }
});

test('Design Project Print Readiness uses the version scoped authenticated GET route and abort signal', async () => {
    const previousAdapter = axiosClient.defaults.adapter;
    let request;
    const result = { projectId: 'project-1', modelVersionId: 'model-1', printReadiness: 'NOT_READY', reasonCode: 'MEASUREMENT_UNAVAILABLE' };
    axiosClient.defaults.adapter = async (config) => {
        request = config;
        return responseFor(config, result);
    };
    const controller = new AbortController();
    try {
        assert.deepEqual(await getAIStudioProjectModelPrintReadiness('project/1', 'model/1', { signal: controller.signal }), result);
        assert.equal(request.method, 'get');
        assert.equal(request.url, '/ai-studio/projects/project%2F1/models/model%2F1/print-readiness');
        assert.equal(request.signal, controller.signal);
        assert.equal(request.headers.get('Authorization'), `Bearer ${testAccessToken}`);
        assert.ok(routes.includes('projectModelPrintReadiness:'));
    } finally {
        axiosClient.defaults.adapter = previousAdapter;
    }
});

test('text Design Project creation sends only project fields, no images, and an authenticated idempotent multipart request', async () => {
    const previousAdapter = axiosClient.defaults.adapter;
    let request;
    axiosClient.defaults.adapter = async (config) => {
        request = config;
        return responseFor(config, { projectId: 'project-text-1' });
    };
    const controller = new AbortController();
    const data = {
        productType: 'figure', styleId: 'chibi-collectible', inputMode: 'text', originalIdea: 'A small fox figure',
    };

    try {
        assert.deepEqual(await createAIStudioProject(data, [], 'text-create-key', { signal: controller.signal }), { projectId: 'project-text-1' });
        assert.equal(request.url, '/ai-studio/projects');
        assert.equal(request.headers.get('Idempotency-Key'), 'text-create-key');
        assert.equal(request.headers.get('Authorization'), `Bearer ${testAccessToken}`);
        assert.equal(request.signal, controller.signal);
        assert.ok(request.data instanceof FormData);
        assert.deepEqual(JSON.parse(await request.data.get('data').text()), data);
        assert.equal(request.data.getAll('images').length, 0);
        assert.equal(request.data.has('quality'), false);
    } finally {
        axiosClient.defaults.adapter = previousAdapter;
    }
});

test('image Design Project creation sends exactly one original File with authentication and idempotency', async () => {
    const previousAdapter = axiosClient.defaults.adapter;
    let request;
    axiosClient.defaults.adapter = async (config) => {
        request = config;
        return responseFor(config, { projectId: 'project-image-1' });
    };
    const controller = new AbortController();
    const file = new File(['image-bytes'], 'same-name.png', { type: 'image/png' });
    const data = {
        productType: 'keychain', keychainVariant: 'ordinary', styleId: 'cute-mascot', inputMode: 'image', originalIdea: 'A cat keychain',
    };

    try {
        assert.deepEqual(await createAIStudioProject(data, [file], 'image-create-key', { signal: controller.signal }), { projectId: 'project-image-1' });
        assert.equal(request.url, '/ai-studio/projects');
        assert.equal(request.headers.get('Idempotency-Key'), 'image-create-key');
        assert.equal(request.headers.get('Authorization'), `Bearer ${testAccessToken}`);
        assert.equal(request.signal, controller.signal);
        assert.ok(request.data instanceof FormData);
        assert.deepEqual(JSON.parse(await request.data.get('data').text()), data);
        assert.equal(request.data.getAll('images').length, 1);
        assert.equal(await request.data.get('images').text(), 'image-bytes');
        assert.equal(request.data.get('images').name, 'same-name.png');
    } finally {
        axiosClient.defaults.adapter = previousAdapter;
    }
});

test('MULTI Design Project creation preserves two, four and eight files in multipart order', async () => {
    const previousAdapter = axiosClient.defaults.adapter;
    const requests = [];
    axiosClient.defaults.adapter = async (config) => {
        requests.push(config);
        return responseFor(config, { projectId: `project-multi-${requests.length}` });
    };

    try {
        for (const count of [2, 4, 8]) {
            const slots = ['front', 'left', 'right', 'back', 'extra-1', 'extra-2', 'extra-3', 'extra-4'].slice(0, count);
            const files = slots.map((slot) => new File([slot], `${slot}.png`, { type: 'image/png' }));
            const data = {
                productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi',
                clientSlots: slots, viewHints: slots.map((slot) => ['front', 'left', 'right', 'back'].includes(slot) ? slot : null),
            };
            await createAIStudioProject(data, files, `multi-${count}-key`);
            const request = requests.at(-1);
            assert.equal(request.headers.get('Idempotency-Key'), `multi-${count}-key`);
            assert.equal(request.headers.get('Authorization'), `Bearer ${testAccessToken}`);
            assert.deepEqual(JSON.parse(await request.data.get('data').text()), data);
            assert.deepEqual(request.data.getAll('images').map((file) => file.name), slots.map((slot) => `${slot}.png`));
            assert.equal(request.data.has('quality'), false);
        }
    } finally {
        axiosClient.defaults.adapter = previousAdapter;
    }
});
