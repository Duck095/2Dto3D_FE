import { isValidPrintDraft } from '../print-quote/printQuotePresentation.js';

const METADATA_FIELDS = [
    ['Format', 'format'],
    ['File size', 'size'],
    ['Dimensions', 'dimensions'],
    ['Faces', 'faces'],
    ['Vertices', 'vertices'],
    ['Quality', 'quality'],
];

const GENERATION_PENDING_STATUSES = new Set(['queued', 'processing']);
const GENERATION_FAILED_STATUSES = new Set(['failed']);
const GENERATION_COMPLETE_STATUSES = new Set(['completed']);
const PENDING_GENERATION_STORAGE_PREFIX = '2dto3d.ai-studio.pending-generation';

export function getGenerationOwnerKey(user) {
    if (!user || typeof user !== 'object' || Array.isArray(user)) return 'anonymous';
    const stableId = user.id ?? user.userId;
    const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    const identity = stableId !== undefined && stableId !== null && String(stableId).trim()
        ? `id:${String(stableId).trim()}`
        : email ? `email:${email}` : '';
    if (!identity) return null;

    let hash = 2166136261;
    for (const character of identity) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return `account-${(hash >>> 0).toString(36)}`;
}

function getPendingGenerationStorageKey(ownerKey) {
    return typeof ownerKey === 'string' && ownerKey.trim()
        ? `${PENDING_GENERATION_STORAGE_PREFIX}:${ownerKey}`
        : null;
}

export function restorePendingGenerationState(storage, ownerKey) {
    try {
        const key = getPendingGenerationStorageKey(ownerKey);
        if (!key) return null;
        const marker = storage?.getItem(key);
        if (marker !== 'pending' && marker !== 'previous-may-run') return null;
        return { status: 'pending', previousRequestMayStillRun: marker === 'previous-may-run' };
    } catch {
        return null;
    }
}

export function persistPendingGenerationState(storage, ownerKey, previousRequestMayStillRun = false) {
    try {
        const key = getPendingGenerationStorageKey(ownerKey);
        if (!key) return;
        storage?.setItem(key, previousRequestMayStillRun ? 'previous-may-run' : 'pending');
    } catch {
        // The in-memory pending guard remains active if session storage is unavailable.
    }
}

export function clearPendingGenerationState(storage, ownerKey) {
    try {
        const key = getPendingGenerationStorageKey(ownerKey);
        if (!key) return;
        storage?.removeItem(key);
    } catch {
        // Storage cleanup must not prevent the active Studio state from progressing.
    }
}

export const initialGenerationSubmissionState = {
    status: 'idle',
    previousRequestMayStillRun: false,
};

export function createGenerationResultsState(ownerKey) {
    return { ownerKey, isGenerated: false, selectedGeneration: null, history: [] };
}

export function getGenerationResultsForOwner(state, ownerKey) {
    return state?.ownerKey === ownerKey ? state : createGenerationResultsState(ownerKey);
}

export function generationResultsReducer(state, action) {
    switch (action.type) {
        case 'reset-owner':
            return createGenerationResultsState(action.ownerKey);
        case 'start':
            if (state?.ownerKey !== action.ownerKey) return state;
            return { ...state, isGenerated: false, selectedGeneration: null };
        case 'completed': {
            if (state?.ownerKey !== action.ownerKey) return state;
            const result = resolveGenerationResponse(action.generation);
            if (result.state !== 'completed') return state;
            const key = result.generation.id ?? result.generation.modelUrl;
            return {
                ...state,
                isGenerated: true,
                selectedGeneration: result.generation,
                history: [result.generation, ...state.history.filter(item => (
                    (item.id ?? item.modelUrl) !== key
                ))],
            };
        }
        case 'select-history': {
            if (state?.ownerKey !== action.ownerKey) return state;
            const key = action.generation?.id ?? action.generation?.modelUrl;
            const stored = state.history.find(item => (item.id ?? item.modelUrl) === key);
            if (!stored || resolveGenerationResponse(stored).state !== 'completed') return state;
            return { ...state, isGenerated: true, selectedGeneration: stored };
        }
        case 'reset-preview':
            if (state?.ownerKey !== action.ownerKey) return state;
            return { ...state, isGenerated: false, selectedGeneration: null };
        default:
            return state;
    }
}

export function generationSubmissionReducer(state, action) {
    switch (action.type) {
        case 'restore':
            return action.state || initialGenerationSubmissionState;
        case 'submit':
            if (state.status === 'pending' || state.status === 'submitting') return state;
            return { ...state, status: 'submitting' };
        case 'pending':
            return { ...state, status: 'pending' };
        case 'indeterminate':
            return { status: 'pending', previousRequestMayStillRun: true };
        case 'completed':
            return { ...state, status: 'completed' };
        case 'failed':
            return { ...state, status: 'failed' };
        case 'invalid':
            return { ...state, status: 'invalid' };
        case 'allow-new-request':
            return state.status === 'pending'
                ? { status: 'idle', previousRequestMayStillRun: true }
                : state;
        default:
            return state;
    }
}

export function resolveGenerationResponse(response) {
    const body = response?.data && typeof response.data === 'object' && !Array.isArray(response.data)
        ? response.data
        : response;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { state: 'invalid', generation: null };
    }

    const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    if (GENERATION_PENDING_STATUSES.has(status)) return { state: 'pending', generation: null };
    if (GENERATION_FAILED_STATUSES.has(status)) return { state: 'failed', generation: null };
    if (!GENERATION_COMPLETE_STATUSES.has(status)
        || typeof body.modelUrl !== 'string'
        || !body.modelUrl.trim()) {
        return { state: 'invalid', generation: null };
    }

    return {
        state: 'completed',
        generation: {
            ...body,
            modelUrl: body.modelUrl.trim(),
            parts: Array.isArray(body.parts) ? body.parts : [],
            files: Array.isArray(body.files) ? body.files : [],
        },
    };
}

export function createPrintDraftFromGeneration(generation, options = {}) {
    if (!generation || !GENERATION_COMPLETE_STATUSES.has(String(generation.status || '').trim().toLowerCase())) {
        return null;
    }

    const productName = typeof options.productName === 'string' ? options.productName.trim() : '';
    const draft = Object.fromEntries(Object.entries({
        id: generation.id,
        title: typeof generation.title === 'string' ? generation.title : undefined,
        productName: productName || (typeof generation.title === 'string' ? generation.title.trim() : ''),
        img: generation.img,
        modelUrl: generation.modelUrl,
        format: generation.format,
        size: generation.size,
        dimensions: generation.dimensions,
        faces: generation.faces,
        vertices: generation.vertices,
        quality: generation.quality,
        parts: Array.isArray(generation.parts) ? generation.parts : undefined,
        modelColor: options.modelColor,
        partColors: options.partColors,
        modelScale: options.modelScale,
    }).filter(([, value]) => value !== undefined));

    return isValidPrintDraft(draft) ? draft : null;
}

export function hasCustomizableParts(generation) {
    return Array.isArray(generation?.parts) && generation.parts.length > 0;
}

export function getConfirmedGenerationMetadata(generation) {
    return METADATA_FIELDS
        .map(([label, key]) => [label, generation?.[key]])
        .filter(([, value]) => value !== undefined && value !== null && value !== '');
}
