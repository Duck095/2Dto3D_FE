const REFERENCE_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const DESIGN_REFERENCE_VIEW_SLOTS = Object.freeze(['front', 'left', 'right', 'back']);

function isIdentifier(value) {
    return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isNullableIdentifier(value) {
    return value === null || isIdentifier(value);
}

function isTimestamp(value) {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function matchesImageSignature(bytes, mimeType) {
    if (mimeType === 'image/png') {
        return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e
            && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    }
    if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (mimeType === 'image/webp') {
        return bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46
            && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    }
    return false;
}

function normalizeReferenceView(view) {
    if (!view || typeof view !== 'object' || Array.isArray(view)
        || !['front', 'left', 'right', 'back'].includes(view.viewSlot)
        || !isIdentifier(view.imageVersionId)
        || !Number.isSafeInteger(view.imageVersionNumber) || view.imageVersionNumber < 1
        || !isNullableIdentifier(view.supersedesImageVersionId)
        || typeof view.artifactUrl !== 'string'
        || !REFERENCE_IMAGE_MIMES.has(view.mimeType)
        || !Number.isSafeInteger(view.byteSize) || view.byteSize < 1
        || typeof view.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(view.sha256)
        || !isTimestamp(view.createdAt)) return null;
    return { ...view };
}

function normalizeTimelineEvent(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)
        || !isIdentifier(event.eventId)
        || !isIdentifier(event.eventType)
        || !isIdentifier(event.recordType)
        || !isTimestamp(event.occurredAt)
        || !isNullableIdentifier(event.versionId)
        || !isNullableIdentifier(event.parentId)
        || !isNullableIdentifier(event.supersedesId)
        || !isNullableIdentifier(event.imageVersionId)
        || !Array.isArray(event.referenceViews)
        || !event.referenceViews.every((view) => normalizeReferenceView(view))
        || new Set(event.referenceViews.map((view) => view.viewSlot)).size !== event.referenceViews.length
        || (event.status !== null && typeof event.status !== 'string')
        || (event.decision !== null && typeof event.decision !== 'string')
        || (event.feedback !== null && typeof event.feedback !== 'string')
        || (event.viewSlot !== null && typeof event.viewSlot !== 'string')
        || (event.artifactUrl !== null && typeof event.artifactUrl !== 'string')
        || (event.mimeType !== null && typeof event.mimeType !== 'string')
        || (event.byteSize !== null && (!Number.isSafeInteger(event.byteSize) || event.byteSize < 0))
        || (event.sha256 !== null && (typeof event.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(event.sha256)))
        || (event.stage !== null && typeof event.stage !== 'string')
        || (event.attemptCount !== null && (!Number.isSafeInteger(event.attemptCount) || event.attemptCount < 0))
        || (event.safeErrorCode !== null && !/^[A-Z0-9][A-Z0-9_.-]{0,63}$/.test(event.safeErrorCode))) return null;

    return { ...event, referenceViews: event.referenceViews.map(normalizeReferenceView) };
}

export function normalizeProjectTimeline(response, expectedProjectId) {
    if (!response || typeof response !== 'object' || Array.isArray(response)
        || !isIdentifier(expectedProjectId)
        || response.projectId !== expectedProjectId
        || !Array.isArray(response.events)) return null;
    const events = response.events.map(normalizeTimelineEvent);
    if (events.includes(null)) return null;
    return { projectId: response.projectId, events };
}

export function hasCompleteReferenceViewSlots(slots) {
    return Array.isArray(slots)
        && slots.length === DESIGN_REFERENCE_VIEW_SLOTS.length
        && new Set(slots).size === DESIGN_REFERENCE_VIEW_SLOTS.length
        && DESIGN_REFERENCE_VIEW_SLOTS.every((slot) => slots.includes(slot));
}

export function getDesignReferenceViewMetadata(timeline, referenceVersionId) {
    if (!timeline || !Array.isArray(timeline.events) || typeof referenceVersionId !== 'string') {
        return { available: false, valid: false, bySlot: new Map() };
    }
    const matchingEvents = timeline.events.filter((event) => event.eventType === 'REFERENCE_VERSION'
        && event.recordType === 'VERSION_STATUS_SNAPSHOT'
        && event.versionId === referenceVersionId);
    if (matchingEvents.length === 0) return { available: false, valid: true, bySlot: new Map() };
    if (matchingEvents.length !== 1) return { available: true, valid: false, bySlot: new Map() };
    const views = matchingEvents[0].referenceViews;
    if (!views.length) return { available: false, valid: true, bySlot: new Map() };
    const slots = views.map((view) => view.viewSlot);
    if (!hasCompleteReferenceViewSlots(slots)) return { available: true, valid: false, bySlot: new Map() };
    return { available: true, valid: true, bySlot: new Map(views.map((view) => [view.viewSlot, view])) };
}

export async function validateDesignReferenceImageBlob(blob, {
    slot,
    expectedMetadata = null,
    createImageBitmapFn = globalThis.createImageBitmap,
    cryptoApi = globalThis.crypto,
} = {}) {
    const mimeType = typeof blob?.type === 'string' ? blob.type.split(';', 1)[0].trim().toLowerCase() : '';
    if (typeof Blob === 'undefined' || !(blob instanceof Blob) || !REFERENCE_IMAGE_MIMES.has(mimeType) || blob.size < 1) {
        return { valid: false, mimeType: null, reason: 'invalid-mime' };
    }
    if (slot && !DESIGN_REFERENCE_VIEW_SLOTS.includes(slot)) return { valid: false, mimeType, reason: 'metadata-mismatch' };
    if (expectedMetadata && (expectedMetadata.viewSlot !== slot
        || expectedMetadata.mimeType !== mimeType
        || expectedMetadata.byteSize !== blob.size
        || typeof expectedMetadata.sha256 !== 'string'
        || !/^[a-f0-9]{64}$/.test(expectedMetadata.sha256))) {
        return { valid: false, mimeType, reason: 'metadata-mismatch' };
    }

    let contentBytes;
    try {
        contentBytes = new Uint8Array(await blob.arrayBuffer());
    } catch {
        return { valid: false, mimeType, reason: 'invalid-content' };
    }
    if (!matchesImageSignature(contentBytes, mimeType)) return { valid: false, mimeType, reason: 'invalid-content' };

    if (expectedMetadata) {
        try {
            if (typeof cryptoApi?.subtle?.digest !== 'function') return { valid: false, mimeType, reason: 'checksum-unavailable' };
            const digest = await cryptoApi.subtle.digest('SHA-256', contentBytes);
            const actualSha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
            if (actualSha256 !== expectedMetadata.sha256) return { valid: false, mimeType, reason: 'checksum-mismatch' };
        } catch {
            return { valid: false, mimeType, reason: 'checksum-unavailable' };
        }
    }

    if (typeof createImageBitmapFn !== 'function') return { valid: false, mimeType, reason: 'decode-unavailable' };
    let bitmap;
    try {
        bitmap = await createImageBitmapFn(blob);
        if (!Number.isFinite(bitmap?.width) || bitmap.width < 1
            || !Number.isFinite(bitmap?.height) || bitmap.height < 1) {
            return { valid: false, mimeType, reason: 'decode-failed' };
        }
        return { valid: true, mimeType, width: bitmap.width, height: bitmap.height };
    } catch {
        return { valid: false, mimeType, reason: 'decode-failed' };
    } finally {
        bitmap?.close?.();
    }
}

function hasNonDegenerateMeshGeometry(scene) {
    if (!scene || typeof scene.traverse !== 'function') return { valid: false, meshCount: 0 };
    scene.updateMatrixWorld?.(true);
    let meshCount = 0;
    let validMeshCount = 0;
    let invalidGeometry = false;
    scene.traverse((child) => {
        if (!child?.isMesh) return;
        meshCount += 1;
        const geometry = child.geometry;
        const positions = geometry?.getAttribute?.('position');
        const indices = geometry?.index;
        if (!positions || positions.count < 3) {
            invalidGeometry = true;
            return;
        }
        const elementCount = indices ? indices.count : positions.count;
        if (elementCount < 3 || elementCount % 3 !== 0) {
            invalidGeometry = true;
            return;
        }
        const matrix = child.matrixWorld?.elements;
        const pointAt = (index) => {
            const x = positions.getX(index);
            const y = positions.getY(index);
            const z = positions.getZ(index);
            if (![x, y, z].every(Number.isFinite)) return null;
            if (!matrix) return [x, y, z];
            const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
            if (!Number.isFinite(w) || Math.abs(w) < 1e-12) return null;
            return [
                (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
                (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
                (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w,
            ];
        };
        let meshHasSurface = false;
        for (let offset = 0; offset < elementCount; offset += 3) {
            const indicesForTriangle = [0, 1, 2].map((position) => indices ? indices.getX(offset + position) : offset + position);
            if (indicesForTriangle.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= positions.count)) {
                invalidGeometry = true;
                return;
            }
            const [a, b, c] = indicesForTriangle.map(pointAt);
            if (!a || !b || !c) {
                invalidGeometry = true;
                return;
            }
            const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
            const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
            const cross = [
                ab[1] * ac[2] - ab[2] * ac[1],
                ab[2] * ac[0] - ab[0] * ac[2],
                ab[0] * ac[1] - ab[1] * ac[0],
            ];
            const areaSquared = cross.reduce((sum, value) => sum + value * value, 0);
            if (Number.isFinite(areaSquared) && areaSquared > 1e-18) meshHasSurface = true;
        }
        if (meshHasSurface) validMeshCount += 1;
        else invalidGeometry = true;
    });
    return { valid: meshCount > 0 && validMeshCount > 0 && !invalidGeometry, meshCount };
}

export function hasUsableDesignModelScene(scene) {
    return hasNonDegenerateMeshGeometry(scene).valid;
}

export async function validateDesignModelArtifactBlob(blob) {
    const mimeType = typeof blob?.type === 'string' ? blob.type.split(';', 1)[0].trim().toLowerCase() : '';
    if (typeof Blob === 'undefined' || !(blob instanceof Blob)
        || mimeType !== 'model/gltf-binary') return { valid: false, mimeType: null, reason: 'invalid-mime' };
    if (blob.size < 24) return { valid: false, mimeType, reason: 'parse-failed' };
    let bytes;
    let sha256 = '';
    try {
        bytes = await blob.arrayBuffer();
        const view = new DataView(bytes);
        if (view.byteLength !== blob.size
            || view.getUint32(0, true) !== 0x46546c67
            || view.getUint32(4, true) !== 2
            || view.getUint32(8, true) !== blob.size) return { valid: false, mimeType, reason: 'parse-failed' };
        const jsonLength = view.getUint32(12, true);
        if (jsonLength < 4 || jsonLength % 4 !== 0
            || view.getUint32(16, true) !== 0x4e4f534a
            || 20 + jsonLength > blob.size) return { valid: false, mimeType, reason: 'parse-failed' };
        const json = new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)).trim();
        const document = JSON.parse(json);
        if (!document || typeof document !== 'object' || document.asset?.version !== '2.0') {
            return { valid: false, mimeType: null, reason: 'parse-failed' };
        }
        if (typeof globalThis.crypto?.subtle?.digest !== 'function') return { valid: false, mimeType, reason: 'checksum-unavailable' };
        const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
        sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch {
        return { valid: false, mimeType: null, reason: 'parse-failed' };
    }

    try {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const loader = new GLTFLoader();
        const gltf = await new Promise((resolve, reject) => loader.parse(bytes, '', resolve, reject));
        const geometryResult = hasNonDegenerateMeshGeometry(gltf?.scene);
        if (!geometryResult.valid) {
            return {
                valid: false,
                mimeType,
                meshCount: geometryResult.meshCount,
                reason: geometryResult.meshCount === 0 ? 'empty-scene' : 'invalid-geometry',
            };
        }
        return { valid: true, mimeType, meshCount: geometryResult.meshCount, sha256 };
    } catch {
        return { valid: false, mimeType, reason: 'parse-failed' };
    }
}
