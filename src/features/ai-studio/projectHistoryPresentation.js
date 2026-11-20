export const PROJECT_HISTORY_PAGE_SIZE = 20;

function isIdentifier(value) {
    return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isNullableIdentifier(value) {
    return value === null || isIdentifier(value);
}

function normalizeOptionalTimestamp(value) {
    return typeof value === 'string'
        && value.trim() === value
        && value.length > 0
        && Number.isFinite(Date.parse(value))
        ? value
        : null;
}

export function normalizeDesignProjectSummary(summary) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)
        || !isIdentifier(summary.projectId)
        || !isIdentifier(summary.productType)
        || !isNullableIdentifier(summary.keychainVariant)
        || !isIdentifier(summary.styleId)
        || !['text', 'image', 'multi'].includes(summary.inputMode)
        || (summary.originalIdea != null && typeof summary.originalIdea !== 'string')
        || !isIdentifier(summary.status)
        || !isNullableIdentifier(summary.latestReferenceVersionId)
        || !isNullableIdentifier(summary.latestModelVersionId)) return null;

    return {
        projectId: summary.projectId,
        productType: summary.productType,
        keychainVariant: summary.keychainVariant,
        styleId: summary.styleId,
        inputMode: summary.inputMode,
        originalIdea: summary.originalIdea ?? null,
        status: summary.status,
        createdAt: normalizeOptionalTimestamp(summary.createdAt),
        updatedAt: normalizeOptionalTimestamp(summary.updatedAt),
        latestReferenceVersionId: summary.latestReferenceVersionId,
        latestModelVersionId: summary.latestModelVersionId,
    };
}

export function normalizeDesignProjectHistoryPage(response, expectedPage, expectedSize = PROJECT_HISTORY_PAGE_SIZE) {
    if (!response || typeof response !== 'object' || Array.isArray(response)
        || !Array.isArray(response.content)
        || !Number.isSafeInteger(expectedPage) || expectedPage < 0
        || !Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > 100
        || response.page !== expectedPage
        || response.size !== expectedSize
        || !Number.isSafeInteger(response.totalElements) || response.totalElements < 0
        || !Number.isSafeInteger(response.totalPages) || response.totalPages < 0
        || response.totalPages !== Math.ceil(response.totalElements / expectedSize)
        || (response.totalPages > 0 && expectedPage >= response.totalPages)
        || (response.totalPages === 0 && response.content.length !== 0)
        || (response.totalPages > 0 && response.content.length === 0)
        || typeof response.first !== 'boolean'
        || typeof response.last !== 'boolean'
        || response.first !== (expectedPage === 0)
        || response.last !== (response.totalPages === 0 || expectedPage >= response.totalPages - 1)
        || response.content.length > expectedSize) return null;

    const content = response.content.map(normalizeDesignProjectSummary);
    if (content.includes(null)) return null;

    return {
        content: deduplicateProjectSummaries(content),
        page: response.page,
        size: response.size,
        totalElements: response.totalElements,
        totalPages: response.totalPages,
        first: response.first,
        last: response.last,
    };
}

export function deduplicateProjectSummaries(projects) {
    const byId = new Map();
    for (const project of projects || []) {
        if (!project?.projectId) continue;
        const previous = byId.get(project.projectId);
        const previousTime = Date.parse(previous?.updatedAt || '') || 0;
        const nextTime = Date.parse(project.updatedAt || '') || 0;
        if (!previous || nextTime >= previousTime) byId.set(project.projectId, project);
    }
    return [...byId.values()];
}

export function mergeDesignProjectHistoryPages(existing, incoming) {
    return deduplicateProjectSummaries([...(existing || []), ...(incoming || [])]);
}

export function getProjectHistoryStateForOwner(state, ownerKey) {
    if (state?.ownerKey === ownerKey) return state;
    return {
        ownerKey,
        phase: 'idle',
        items: [],
        page: -1,
        size: PROJECT_HISTORY_PAGE_SIZE,
        totalElements: 0,
        totalPages: 0,
        last: true,
        loadingMore: false,
        message: '',
        pageError: '',
    };
}

export function classifyProjectHistoryError(error) {
    const status = error?.response?.status;
    if (status === 401) return { phase: 'auth-required', message: 'Vui lòng đăng nhập để tải danh sách dự án.' };
    if (status === 403) return { phase: 'forbidden', message: 'Tài khoản hiện không có quyền xem danh sách dự án.' };
    return { phase: 'error', message: 'Chưa tải được danh sách dự án từ Backend. Bạn có thể thử lại.' };
}
