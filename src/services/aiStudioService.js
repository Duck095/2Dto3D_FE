import axiosClient from '../config/axiosClient.js';
import { API_ROUTES } from '../config/apiRoutes.js';

export async function createAIGeneration(data, image, idempotencyKey, options = {}) {
    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (image) {
        formData.append('image', image);
    }

    return axiosClient.post(API_ROUTES.aiStudio.generations, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            'Idempotency-Key': idempotencyKey,
        },
        signal: options.signal,
        timeout: 60000,
    });
}

export function getAIGeneration(id, options = {}) {
    return axiosClient.get(API_ROUTES.aiStudio.generation(encodeURIComponent(id)), { signal: options.signal });
}

export function getAIGenerationHistory(page = 0, size = 20, options = {}) {
    return axiosClient.get(API_ROUTES.aiStudio.generationHistory, { params: { page, size }, signal: options.signal });
}

export function refreshAIGeneration(id, idempotencyKey, options = {}) {
    return axiosClient.post(API_ROUTES.aiStudio.retryGeneration(encodeURIComponent(id)), null, {
        headers: { 'Idempotency-Key': idempotencyKey },
        signal: options.signal,
    });
}

export async function downloadAIGenerationModel(id, format) {
    const response = await axiosClient.get(API_ROUTES.aiStudio.modelDownload(id, format), {
        responseType: 'blob',
        timeout: 120000,
    });
    const url = URL.createObjectURL(response);
    const link = document.createElement('a');
    link.href = url;
    link.download = `morphia-studio-${id}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export function consumeAIGenerationDownload(id) {
    return axiosClient.post(API_ROUTES.aiStudio.consumeDownload(id));
}

function mutationConfig(idempotencyKey, options = {}) {
    return {
        headers: { 'Idempotency-Key': idempotencyKey },
        signal: options.signal,
    };
}

function projectIdPath(projectId) {
    return API_ROUTES.aiStudio.project(projectId);
}

export async function createAIStudioProject(data, images = [], idempotencyKey, options = {}) {
    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const imageList = images == null
        ? []
        : Array.isArray(images)
            ? images
            : typeof images[Symbol.iterator] === 'function' && !(images instanceof Blob)
                ? Array.from(images)
                : [images];
    imageList.forEach((image) => formData.append('images', image));
    const config = mutationConfig(idempotencyKey, options);

    return axiosClient.post(API_ROUTES.aiStudio.projects, formData, {
        ...config,
        headers: {
            ...config.headers,
            'Content-Type': 'multipart/form-data',
        },
        timeout: 60000,
    });
}

export function getAIStudioProject(projectId, options = {}) {
    return axiosClient.get(projectIdPath(projectId), { signal: options.signal });
}

export function getAIStudioProjectHistory(page = 0, size = 20, options = {}) {
    return axiosClient.get(API_ROUTES.aiStudio.projects, {
        params: { page, size },
        signal: options.signal,
    });
}

export function getAIStudioProjectInputContent(projectId, inputId, options = {}) {
    return axiosClient.get(API_ROUTES.aiStudio.projectInputContent(projectId, inputId), {
        responseType: 'blob',
        signal: options.signal,
    });
}

export function getAIStudioProjectPipeline(projectId, options = {}) {
    return axiosClient.get(API_ROUTES.aiStudio.projectPipeline(projectId), { signal: options.signal });
}

export function getAIStudioProjectTimeline(projectId, options = {}) {
    return axiosClient.get(API_ROUTES.aiStudio.projectTimeline(projectId), { signal: options.signal });
}

export function generateAIStudioProjectReferences(projectId, data, idempotencyKey, options = {}) {
    return axiosClient.post(API_ROUTES.aiStudio.projectReferenceGenerate(projectId), data, mutationConfig(idempotencyKey, options));
}

export function approveAIStudioProjectReference(projectId, versionId, data, idempotencyKey, options = {}) {
    return axiosClient.post(
        API_ROUTES.aiStudio.projectReferenceApproval(projectId, versionId),
        data,
        mutationConfig(idempotencyKey, options),
    );
}

export function generateAIStudioProjectModel(projectId, data, idempotencyKey, options = {}) {
    return axiosClient.post(API_ROUTES.aiStudio.projectModelGenerate(projectId), data, mutationConfig(idempotencyKey, options));
}

export function approveAIStudioProjectModel(projectId, modelVersionId, data, idempotencyKey, options = {}) {
    return axiosClient.post(
        API_ROUTES.aiStudio.projectModelApproval(projectId, modelVersionId),
        data,
        mutationConfig(idempotencyKey, options),
    );
}

export function getAIStudioProjectReferenceView(projectId, versionId, slot, options = {}) {
    return axiosClient.get(
        API_ROUTES.aiStudio.projectReferenceView(
            projectId, versionId, slot,
        ),
        { responseType: 'blob', signal: options.signal },
    );
}

export function getAIStudioProjectModelArtifact(projectId, modelVersionId, options = {}) {
    return axiosClient.get(
        API_ROUTES.aiStudio.projectModelArtifact(projectId, modelVersionId),
        { responseType: 'blob', signal: options.signal },
    );
}

export function getAIStudioProjectModelPrintReadiness(projectId, modelVersionId, options = {}) {
    return axiosClient.get(
        API_ROUTES.aiStudio.projectModelPrintReadiness(projectId, modelVersionId),
        { signal: options.signal },
    );
}
