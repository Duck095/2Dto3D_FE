export const PIPELINE_POLL_INTERVAL_MS = 8000;
export const MAX_AUTOMATIC_PIPELINE_READS = 15;

const PROJECT_STATUSES = new Set([
    'DRAFT', 'REFERENCES_QUEUED', 'REFERENCES_GENERATING', 'REFERENCES_REVIEW',
    'REFERENCES_APPROVED', 'MODEL_QUEUED', 'MODEL_GENERATING', 'MODEL_REVIEW', 'COMPLETED', 'FAILED',
]);
const VERSION_STATUSES = new Set(['GENERATING', 'READY_FOR_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'FAILED']);
const JOB_STATUSES = new Set(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']);
const ACTIVE_JOB_STATUSES = new Set(['PENDING', 'PROCESSING']);

const STATUS_LABELS = {
    DRAFT: 'Bản nháp',
    REFERENCES_QUEUED: 'Đang chờ tạo ảnh tham chiếu',
    REFERENCES_GENERATING: 'Đang tạo ảnh tham chiếu',
    REFERENCES_REVIEW: 'Ảnh tham chiếu chờ duyệt',
    REFERENCES_APPROVED: 'Ảnh tham chiếu đã duyệt',
    MODEL_QUEUED: 'Đang chờ dựng model',
    MODEL_GENERATING: 'Đang dựng model',
    MODEL_REVIEW: 'Model chờ duyệt',
    COMPLETED: 'Đã hoàn tất',
    FAILED: 'Thất bại',
    GENERATING: 'Đang tạo',
    READY_FOR_REVIEW: 'Sẵn sàng để duyệt',
    APPROVED: 'Đã duyệt',
    CHANGES_REQUESTED: 'Được yêu cầu chỉnh sửa',
    PENDING: 'Đang chờ',
    PROCESSING: 'Đang xử lý',
    CANCELLED: 'Đã hủy',
};

const EMPTY_PIPELINE_STATE = Object.freeze({ ownerKey: null, projectId: '', phase: 'idle', pipeline: null, message: '' });

function isIdentifier(value) {
    return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isTimestamp(value) {
    return typeof value === 'string' && value.trim() === value && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isNullableIdentifier(value) {
    return value === null || isIdentifier(value);
}

function normalizeReferenceVersion(version) {
    if (!version || typeof version !== 'object' || Array.isArray(version)
        || !isIdentifier(version.versionId)
        || !Number.isSafeInteger(version.versionNumber) || version.versionNumber < 1
        || !isIdentifier(version.status)
        || !Array.isArray(version.availableViews)
        || !version.availableViews.every(isIdentifier)
        || !isNullableIdentifier(version.parentVersionId)
        || !isTimestamp(version.createdAt)) return null;

    return {
        versionId: version.versionId,
        versionNumber: version.versionNumber,
        status: version.status,
        availableViews: [...version.availableViews],
        parentVersionId: version.parentVersionId,
        createdAt: version.createdAt,
    };
}

function normalizeModelVersion(version) {
    if (!version || typeof version !== 'object' || Array.isArray(version)
        || !isIdentifier(version.modelVersionId)
        || !Number.isSafeInteger(version.versionNumber) || version.versionNumber < 1
        || !isNullableIdentifier(version.referenceVersionId)
        || !isIdentifier(version.status)
        || !isNullableIdentifier(version.supersedesModelVersionId)
        || typeof version.artifactAvailable !== 'boolean'
        || !isTimestamp(version.createdAt)) return null;

    return {
        modelVersionId: version.modelVersionId,
        versionNumber: version.versionNumber,
        referenceVersionId: version.referenceVersionId,
        status: version.status,
        supersedesModelVersionId: version.supersedesModelVersionId,
        artifactAvailable: version.artifactAvailable,
        createdAt: version.createdAt,
    };
}

function normalizeSafeErrorCode(value) {
    return typeof value === 'string' && /^[A-Z0-9][A-Z0-9_.-]{0,63}$/.test(value) ? value : null;
}

function normalizePipelineJob(job) {
    if (!job || typeof job !== 'object' || Array.isArray(job)
        || !isIdentifier(job.jobId)
        || !isIdentifier(job.stage)
        || !isIdentifier(job.status)
        || !Number.isSafeInteger(job.attemptCount) || job.attemptCount < 0
        || !isTimestamp(job.createdAt)
        || !isTimestamp(job.updatedAt)) return null;

    return {
        jobId: job.jobId,
        stage: job.stage,
        status: job.status,
        safeErrorCode: normalizeSafeErrorCode(job.safeErrorCode),
        attemptCount: job.attemptCount,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
    };
}

function isKnownStatus(status, kind) {
    if (kind === 'project') return PROJECT_STATUSES.has(status);
    if (kind === 'reference' || kind === 'model') return VERSION_STATUSES.has(status);
    if (kind === 'job') return JOB_STATUSES.has(status);
    return false;
}

export function normalizeProjectPipeline(response, expectedProjectId) {
    if (!response || typeof response !== 'object' || Array.isArray(response)
        || !isIdentifier(expectedProjectId)
        || response.projectId !== expectedProjectId
        || !isIdentifier(response.projectStatus)
        || !Array.isArray(response.referenceVersions)
        || !Array.isArray(response.modelVersions)
        || !Array.isArray(response.jobs)) return null;

    const referenceVersions = response.referenceVersions.map(normalizeReferenceVersion);
    const modelVersions = response.modelVersions.map(normalizeModelVersion);
    const jobs = response.jobs.map(normalizePipelineJob);
    if (referenceVersions.includes(null) || modelVersions.includes(null) || jobs.includes(null)) return null;
    if (new Set(referenceVersions.map((version) => version.versionNumber)).size !== referenceVersions.length
        || new Set(modelVersions.map((version) => version.versionNumber)).size !== modelVersions.length) return null;

    // Keep unrecognized Backend states as data, but label them neutrally in the UI.
    return {
        projectId: response.projectId,
        projectStatus: response.projectStatus,
        referenceVersions: [...referenceVersions].sort((left, right) => left.versionNumber - right.versionNumber),
        modelVersions: [...modelVersions].sort((left, right) => left.versionNumber - right.versionNumber),
        jobs,
    };
}

export function getPipelineStatusLabel(status, kind) {
    if (!isKnownStatus(status, kind)) return 'Trạng thái chưa nhận diện';
    return STATUS_LABELS[status] || 'Trạng thái chưa nhận diện';
}

export function hasActivePipelineJobs(pipeline) {
    return Array.isArray(pipeline?.jobs) && pipeline.jobs.some((job) => ACTIVE_JOB_STATUSES.has(job?.status));
}

export function shouldContinuePipelinePolling(pipeline, automaticReadCount, pageVisible = true) {
    return pageVisible
        && hasActivePipelineJobs(pipeline)
        && Number.isSafeInteger(automaticReadCount)
        && automaticReadCount >= 0
        && automaticReadCount < MAX_AUTOMATIC_PIPELINE_READS;
}

export function getPipelineJobFailureMessage(job) {
    if (job?.status !== 'FAILED') return null;
    const safeErrorCode = normalizeSafeErrorCode(job.safeErrorCode);
    return safeErrorCode ? `Mã lỗi: ${safeErrorCode}` : 'Backend báo công việc thất bại.';
}

export function classifyPipelineReadError(error) {
    const status = error?.response?.status;
    const code = error?.response?.data?.code;
    if (status === 401) {
        return { phase: 'auth-required', message: 'Phiên đăng nhập cần được xác thực lại trước khi đọc Pipeline.' };
    }
    if (status === 403 || status === 404 || code === 'FEATURE_DISABLED') {
        return { phase: 'unavailable', message: 'Pipeline chưa khả dụng hoặc tài khoản hiện không có quyền đọc.' };
    }
    return { phase: 'error', message: 'Chưa đọc được trạng thái Pipeline từ Backend. Bạn có thể thử đọc lại.' };
}

export function getProjectPipelineStateForOwner(state, ownerKey, projectId) {
    if (state?.ownerKey === ownerKey && state?.projectId === projectId && isIdentifier(projectId)) return state;
    return { ...EMPTY_PIPELINE_STATE, ownerKey, projectId: isIdentifier(projectId) ? projectId : '' };
}
