import { getStylesForProduct } from './studioPresentation.js';

const PRODUCT_TYPES = new Set(['keychain', 'night-light', 'figure']);
const KEYCHAIN_VARIANTS = new Set(['ordinary', 'click']);
const MULTI_VIEW_ORDER = ['front', 'left', 'right', 'back'];

function getMultiSlotOrder(slotId) {
    const coreIndex = MULTI_VIEW_ORDER.indexOf(slotId);
    if (coreIndex >= 0) return coreIndex;
    const extraMatch = typeof slotId === 'string' ? /^extra-([1-4])$/.exec(slotId) : null;
    return extraMatch ? MULTI_VIEW_ORDER.length + Number(extraMatch[1]) - 1 : -1;
}

function isValidProjectSlotList(clientSlots) {
    return Array.isArray(clientSlots)
        && clientSlots.length >= 2
        && clientSlots.length <= 8
        && clientSlots.every((slotId) => getMultiSlotOrder(slotId) >= 0)
        && new Set(clientSlots).size === clientSlots.length;
}

function isValidProjectViewHints(viewHints) {
    return Array.isArray(viewHints)
        && viewHints.length <= 8
        && viewHints.every((hint) => hint === null || MULTI_VIEW_ORDER.includes(hint));
}

export function buildTextDesignProjectRequest({ productType, keychainVariant, styleId, originalIdea } = {}) {
    if (!PRODUCT_TYPES.has(productType)) return { error: 'product', data: null };
    if (productType === 'keychain' && !KEYCHAIN_VARIANTS.has(keychainVariant)) {
        return { error: 'keychainVariant', data: null };
    }

    const validStyle = getStylesForProduct(productType, keychainVariant)
        .some((style) => style.id === styleId);
    if (!validStyle) return { error: 'style', data: null };
    if (typeof originalIdea !== 'string' || !originalIdea.trim()) return { error: 'idea', data: null };
    if (originalIdea.trim().length > 4000) return { error: 'idea-too-long', data: null };

    return {
        error: null,
        data: {
            productType,
            ...(productType === 'keychain' ? { keychainVariant } : {}),
            styleId,
            inputMode: 'text',
            originalIdea: originalIdea.trim(),
        },
    };
}

export function buildImageDesignProjectRequest({ productType, keychainVariant, styleId, originalIdea = '' } = {}) {
    if (!PRODUCT_TYPES.has(productType)) return { error: 'product', data: null };
    if (productType === 'keychain' && !KEYCHAIN_VARIANTS.has(keychainVariant)) {
        return { error: 'keychainVariant', data: null };
    }

    const validStyle = getStylesForProduct(productType, keychainVariant)
        .some((style) => style.id === styleId);
    if (!validStyle) return { error: 'style', data: null };
    if (typeof originalIdea !== 'string') return { error: 'idea', data: null };
    if (originalIdea.trim().length > 4000) return { error: 'idea-too-long', data: null };

    const idea = originalIdea.trim();
    return {
        error: null,
        data: {
            productType,
            ...(productType === 'keychain' ? { keychainVariant } : {}),
            styleId,
            inputMode: 'image',
            ...(idea ? { originalIdea: idea } : {}),
        },
    };
}

export function buildMultiDesignProjectRequest({ productType, keychainVariant, styleId, originalIdea = '', uploads } = {}) {
    if (!PRODUCT_TYPES.has(productType)) return { error: 'product', data: null };
    if (productType === 'keychain' && !KEYCHAIN_VARIANTS.has(keychainVariant)) {
        return { error: 'keychainVariant', data: null };
    }

    const validStyle = getStylesForProduct(productType, keychainVariant)
        .some((style) => style.id === styleId);
    if (!validStyle) return { error: 'style', data: null };
    if (typeof originalIdea !== 'string') return { error: 'idea', data: null };
    if (originalIdea.trim().length > 4000) return { error: 'idea-too-long', data: null };
    if (!Array.isArray(uploads) || uploads.length < 2 || uploads.length > 8) {
        return { error: 'image-count', data: null };
    }

    const orderedUploads = [...uploads];
    if (orderedUploads.some((upload) => (
        !upload || typeof upload !== 'object' || getMultiSlotOrder(upload.slotId) < 0 || !upload.file
    ))) return { error: 'slots', data: null };
    if (new Set(orderedUploads.map((upload) => upload.slotId)).size !== orderedUploads.length) {
        return { error: 'slots', data: null };
    }
    orderedUploads.sort((left, right) => getMultiSlotOrder(left.slotId) - getMultiSlotOrder(right.slotId));

    const idea = originalIdea.trim();
    const clientSlots = orderedUploads.map((upload) => upload.slotId);
    return {
        error: null,
        data: {
            productType,
            ...(productType === 'keychain' ? { keychainVariant } : {}),
            styleId,
            inputMode: 'multi',
            ...(idea ? { originalIdea: idea } : {}),
            clientSlots,
            viewHints: clientSlots.map((slotId) => MULTI_VIEW_ORDER.includes(slotId) ? slotId : null),
        },
        files: orderedUploads.map((upload) => upload.file),
        uploads: orderedUploads,
    };
}

export async function getImageContentSha256(file, cryptoApi = globalThis.crypto) {
    if (!file || typeof file.arrayBuffer !== 'function') throw new TypeError('A file is required to identify image content.');
    if (typeof cryptoApi?.subtle?.digest !== 'function') throw new Error('Web Crypto SHA-256 is unavailable.');
    const digest = await cryptoApi.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hasMatchingProjectInputBlob(blob, input) {
    if (typeof Blob === 'undefined' || !(blob instanceof Blob) || !input || typeof input !== 'object') return false;
    const expectedMime = typeof input.mimeType === 'string' ? input.mimeType.split(';', 1)[0].trim().toLowerCase() : '';
    const actualMime = typeof blob.type === 'string' ? blob.type.split(';', 1)[0].trim().toLowerCase() : '';
    return Boolean(expectedMime) && actualMime === expectedMime && blob.size === input.byteSize;
}

export function getCreatedDesignProjectId(response) {
    const projectId = response?.projectId ?? response?.id;
    return typeof projectId === 'string' && projectId.trim() ? projectId.trim() : null;
}

export function getDesignProjectStateForOwner(state, ownerKey) {
    if (state?.ownerKey === ownerKey) return state;
    return { ownerKey, phase: 'idle', projectId: '', project: null, message: '' };
}

export function claimDesignProjectSave(inFlightOwners, ownerKey) {
    if (!ownerKey || inFlightOwners.has(ownerKey)) return false;
    inFlightOwners.add(ownerKey);
    return true;
}

export function releaseDesignProjectSave(inFlightOwners, ownerKey) {
    inFlightOwners.delete(ownerKey);
}

export function createDesignProjectIdempotencyRecord(data, savedRecord, createKey, imageContentSha256 = null) {
    if (data?.inputMode === 'multi') throw new Error('MULTI request identity must use asynchronous SHA-256.');
    const fingerprint = getDesignProjectRequestFingerprint(data, imageContentSha256);
    const key = savedRecord?.fingerprint === fingerprint && typeof savedRecord?.key === 'string' && savedRecord.key
        ? savedRecord.key : createKey();
    return { key, fingerprint };
}

export function getDesignProjectRequestFingerprint(data, imageContentSha256 = null) {
    if (data?.inputMode === 'multi') throw new Error('MULTI request identity must use asynchronous SHA-256.');
    const identity = imageContentSha256 ? { data, imageContentSha256 } : data;
    const serialized = JSON.stringify(identity);
    let hash = 2166136261;
    for (let index = 0; index < serialized.length; index += 1) {
        hash = Math.imul(hash ^ serialized.charCodeAt(index), 16777619);
    }
    return `${(hash >>> 0).toString(36)}-${serialized.length}`;
}

function serializeCanonical(value) {
    if (Array.isArray(value)) return `[${value.map(serializeCanonical).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${serializeCanonical(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function normalizeMultiImageHashes(data, imageHashes) {
    let hashes = imageHashes;
    if (typeof hashes === 'string') {
        try { hashes = JSON.parse(hashes); } catch { hashes = null; }
    }
    if (!Array.isArray(hashes)
        || !Array.isArray(data?.clientSlots)
        || hashes.length !== data.clientSlots.length
        || hashes.length < 2
        || hashes.length > 8) {
        throw new Error('MULTI image content hashes are incomplete.');
    }
    const normalized = hashes.map((entry, index) => {
        if (!entry || entry.slotId !== data.clientSlots[index]
            || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
            throw new Error('MULTI image content hashes are invalid or out of order.');
        }
        return { slotId: entry.slotId, sha256: entry.sha256 };
    });
    return normalized;
}

export async function getMultiDesignProjectRequestFingerprint(data, imageHashes, cryptoApi = globalThis.crypto) {
    if (data?.inputMode !== 'multi') throw new Error('A MULTI Design Project request is required.');
    if (typeof cryptoApi?.subtle?.digest !== 'function') throw new Error('Web Crypto SHA-256 is unavailable.');
    const orderedImageHashes = normalizeMultiImageHashes(data, imageHashes);
    const canonicalIdentity = serializeCanonical({ data, imageHashes: orderedImageHashes });
    const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(canonicalIdentity));
    const hexDigest = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `multi-v3-sha256:${hexDigest}`;
}

export async function createMultiDesignProjectIdempotencyRecord(data, savedRecord, createKey, imageHashes, cryptoApi = globalThis.crypto) {
    const classification = classifyDesignProjectIdempotencyRecord(savedRecord);
    if (classification !== 'none' && classification !== 'multi-v3') {
        throw new Error('The saved MULTI request requires manual reconciliation.');
    }
    const fingerprint = await getMultiDesignProjectRequestFingerprint(data, imageHashes, cryptoApi);
    const key = classification === 'multi-v3' && savedRecord.fingerprint === fingerprint
        ? savedRecord.key : createKey();
    return { key, fingerprint };
}

export function isLegacyMultiDesignProjectIdempotencyRecord(record) {
    return ['legacy-fnv', 'legacy-multi-v2'].includes(classifyDesignProjectIdempotencyRecord(record));
}

export function classifyDesignProjectIdempotencyRecord(record) {
    if (record === null || record === undefined) return 'none';
    if (!record || typeof record !== 'object' || Array.isArray(record)
        || typeof record.key !== 'string' || !record.key.trim()
        || typeof record.fingerprint !== 'string' || !record.fingerprint) return 'unknown';
    if (/^multi-v3-sha256:[a-f0-9]{64}$/.test(record.fingerprint)) return 'multi-v3';
    if (record.fingerprint.startsWith('multi-v2:')) return 'legacy-multi-v2';
    if (/^[a-z0-9]+-\d+$/.test(record.fingerprint)) return 'legacy-fnv';
    return 'unknown';
}

export function parseDesignProjectIdempotencyRecord(serializedRecord) {
    if (serializedRecord === null) return { classification: 'none', record: null };
    if (typeof serializedRecord !== 'string') return { classification: 'unknown', record: null };
    try {
        const record = JSON.parse(serializedRecord);
        if (!record || typeof record !== 'object' || Array.isArray(record)) return { classification: 'unknown', record: null };
        return { classification: classifyDesignProjectIdempotencyRecord(record), record };
    } catch {
        return { classification: 'unknown', record: null };
    }
}

export function resolveDesignProject(project, projectId) {
    if (!project || typeof project !== 'object' || Array.isArray(project)) return null;
    if (typeof projectId !== 'string' || !projectId.trim()) return null;
    const responseProjectId = project.projectId ?? project.id;
    if (responseProjectId !== undefined && responseProjectId !== null
        && (typeof responseProjectId !== 'string' || responseProjectId.trim() !== projectId.trim())) return null;
    if (!PRODUCT_TYPES.has(project.productType)) return null;
    if (!['text', 'image', 'multi'].includes(project.inputMode)) return null;
    if (project.productType === 'keychain' && !KEYCHAIN_VARIANTS.has(project.keychainVariant)) return null;
    if (!getStylesForProduct(project.productType, project.keychainVariant).some((style) => style.id === project.styleId)) {
        return null;
    }
    if (typeof project.status !== 'string' || !project.status.trim()) return null;
    if (project.inputMode === 'text' && (typeof project.originalIdea !== 'string' || !project.originalIdea.trim())) return null;
    if (project.inputMode !== 'text' && project.originalIdea != null && typeof project.originalIdea !== 'string') return null;
    const inputs = project.inputs === undefined ? [] : project.inputs;
    if (!Array.isArray(inputs) || inputs.some((input) => !input || typeof input !== 'object'
        || typeof input.inputId !== 'string' || !input.inputId.trim()
        || !Number.isSafeInteger(input.order) || input.order < 0
        || !['image/png', 'image/jpeg', 'image/webp'].includes(input.mimeType)
        || !Number.isSafeInteger(input.byteSize) || input.byteSize < 1
        || typeof input.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.sha256)
        || (input.clientSlot != null && (typeof input.clientSlot !== 'string' || !input.clientSlot.trim()))
        || (input.viewHint != null && typeof input.viewHint !== 'string'))) return null;
    const orderedInputs = [...inputs].sort((left, right) => left.order - right.order);
    if (orderedInputs.some((input, index) => input.order !== index)
        || new Set(orderedInputs.map((input) => input.inputId)).size !== orderedInputs.length) return null;
    if (project.inputMode === 'text' && orderedInputs.length > 0) return null;
    if (project.inputMode === 'image' && orderedInputs.length > 1) return null;
    if (project.inputMode === 'multi' && orderedInputs.length > 8) return null;

    const responseClientSlots = project.clientSlots ?? (project.inputMode === 'multi' && orderedInputs.length > 0
        ? orderedInputs.map((input) => input.clientSlot)
        : undefined);
    const responseViewHints = project.viewHints ?? (project.inputMode === 'multi' && orderedInputs.length > 0
        ? orderedInputs.map((input) => input.viewHint)
        : undefined);
    if (project.inputMode === 'multi') {
        if (responseClientSlots !== undefined && !isValidProjectSlotList(responseClientSlots)) return null;
        if (responseViewHints !== undefined && !isValidProjectViewHints(responseViewHints)) return null;
        if (Array.isArray(responseClientSlots) && Array.isArray(responseViewHints)
            && responseClientSlots.length !== responseViewHints.length) return null;
        if (orderedInputs.length > 0 && (orderedInputs.length < 2
            || orderedInputs.some((input, index) => input.clientSlot !== responseClientSlots[index]))) return null;
    }

    return {
        projectId: typeof responseProjectId === 'string' ? responseProjectId.trim() : projectId.trim(),
        productType: project.productType,
        ...(project.productType === 'keychain' ? { keychainVariant: project.keychainVariant } : {}),
        styleId: project.styleId,
        inputMode: project.inputMode,
        status: project.status,
        inputs: orderedInputs,
        ...(typeof project.originalIdea === 'string' && project.originalIdea.trim() ? { originalIdea: project.originalIdea } : {}),
        ...(project.inputMode === 'multi' && Array.isArray(responseClientSlots) ? { clientSlots: [...responseClientSlots] } : {}),
        ...(project.inputMode === 'multi' && Array.isArray(responseViewHints) ? { viewHints: [...responseViewHints] } : {}),
    };
}

export function classifyDesignProjectRequestError(error) {
    const status = error?.response?.status;
    if (status === 401) return { outcome: 'rejected', code: 'unauthenticated' };
    if (status === 403) return { outcome: 'rejected', code: 'forbidden' };
    if (status === 408 || status === 429 || status >= 500
        || !error?.response
        || ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(error?.code)) {
        return { outcome: 'indeterminate', code: 'unknown' };
    }
    return { outcome: 'rejected', code: 'backend' };
}
