import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import {
    normalizeProjectTimeline,
    validateDesignModelArtifactBlob,
    validateDesignReferenceImageBlob,
} from './projectWorkflowPresentation.js';

const timeline = (projectId, events = []) => ({ projectId, events });
const event = (eventId, extra = {}) => ({
    eventId,
    eventType: 'REFERENCE_VERSION',
    recordType: 'VERSION_STATUS_SNAPSHOT',
    occurredAt: '2026-11-18T10:00:00Z',
    versionId: 'reference-1',
    status: 'READY_FOR_REVIEW',
    decision: null,
    feedback: null,
    parentId: null,
    supersedesId: null,
    viewSlot: null,
    imageVersionId: null,
    artifactUrl: null,
    mimeType: null,
    byteSize: null,
    sha256: null,
    stage: null,
    attemptCount: null,
    safeErrorCode: null,
    referenceViews: [],
    ...extra,
});

test('Timeline normalization preserves Backend version lineage and ordered reference view metadata', () => {
    const input = timeline('project-1', [event('event-1', {
        parentId: 'reference-0',
        referenceViews: [{ viewSlot: 'front', imageVersionId: 'image-1', imageVersionNumber: 2,
            supersedesImageVersionId: 'image-0', artifactUrl: '/api/private', mimeType: 'image/png',
            byteSize: 32, sha256: 'a'.repeat(64), createdAt: '2026-11-18T10:00:00Z' }],
    })]);
    const normalized = normalizeProjectTimeline(input, 'project-1');
    assert.equal(normalized.projectId, 'project-1');
    assert.equal(normalized.events[0].parentId, 'reference-0');
    assert.equal(normalized.events[0].referenceViews[0].imageVersionId, 'image-1');
    assert.equal(normalized.events[0].referenceViews[0].viewSlot, 'front');
});

test('Timeline normalization rejects a different project and malformed event metadata', () => {
    assert.equal(normalizeProjectTimeline(timeline('project-2', []), 'project-1'), null);
    assert.equal(normalizeProjectTimeline(timeline('project-1', [event('event-1', { referenceViews: [{}] })]), 'project-1'), null);
    assert.equal(normalizeProjectTimeline(timeline('project-1', [event('', {})]), 'project-1'), null);
});

test('reference image content must be a supported image Blob', () => {
    return validateDesignReferenceImageBlob(new Blob(['html'], { type: 'text/html' })).then(result => assert.equal(result.valid, false));
});

function makeGlb(json, binary = new Uint8Array()) {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
    const jsonLength = Math.ceil(jsonBytes.byteLength / 4) * 4;
    const binaryLength = Math.ceil(binary.byteLength / 4) * 4;
    const hasBinary = binaryLength > 0;
    const bytes = new Uint8Array(12 + 8 + jsonLength + (hasBinary ? 8 + binaryLength : 0));
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, bytes.byteLength, true);
    view.setUint32(12, jsonLength, true);
    view.setUint32(16, 0x4e4f534a, true);
    bytes.fill(0x20, 20, 20 + jsonLength);
    bytes.set(jsonBytes, 20);
    if (hasBinary) {
        const binaryHeader = 20 + jsonLength;
        view.setUint32(binaryHeader, binaryLength, true);
        view.setUint32(binaryHeader + 4, 0x004e4942, true);
        bytes.set(binary, binaryHeader + 8);
    }
    return new Blob([bytes], { type: 'model/gltf-binary' });
}

function triangleGlb(positions = [0, 0, 0, 1, 0, 0, 0, 1, 0]) {
    const binary = new Float32Array(positions);
    return makeGlb({
        asset: { version: '2.0' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
        buffers: [{ byteLength: binary.byteLength }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: binary.byteLength, target: 34962 }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
    }, new Uint8Array(binary.buffer));
}

test('MIME-valid reference bytes must decode before they become ready', async () => {
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' });
    const result = await validateDesignReferenceImageBlob(blob, {
        createImageBitmapFn: async () => { throw new Error('decode rejected'); },
    });
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'decode-failed');
});

test('image MIME must agree with actual file signature before decoding', async () => {
    const blob = new Blob(['not an image'], { type: 'image/png' });
    const result = await validateDesignReferenceImageBlob(blob, { createImageBitmapFn: async () => ({ width: 1, height: 1 }) });
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'invalid-content');
});

test('reference slots must contain each canonical view exactly once', async () => {
    const { hasCompleteReferenceViewSlots } = await import('./projectWorkflowPresentation.js');
    assert.equal(hasCompleteReferenceViewSlots(['front', 'left', 'right', 'back']), true);
    assert.equal(hasCompleteReferenceViewSlots(['front', 'left', 'right', 'right']), false);
    assert.equal(hasCompleteReferenceViewSlots(['front', 'left', 'right']), false);
    assert.equal(hasCompleteReferenceViewSlots(['front', 'left', 'right', 'top']), false);
});

test('reference bytes are checked against Timeline metadata for the matching version and slot', async () => {
    const image = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' });
    const digest = await webcrypto.subtle.digest('SHA-256', await image.arrayBuffer());
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const metadata = { viewSlot: 'front', mimeType: 'image/png', byteSize: image.size, sha256 };
    const decode = async () => ({ width: 1, height: 1, close() {} });
    assert.equal((await validateDesignReferenceImageBlob(image, { slot: 'front', expectedMetadata: metadata, createImageBitmapFn: decode, cryptoApi: webcrypto })).valid, true);
    assert.equal((await validateDesignReferenceImageBlob(image, { slot: 'front', expectedMetadata: { ...metadata, sha256: '0'.repeat(64) }, createImageBitmapFn: decode, cryptoApi: webcrypto })).reason, 'checksum-mismatch');
    assert.equal((await validateDesignReferenceImageBlob(image, { expectedMetadata: { ...metadata, viewSlot: 'back' }, slot: 'front', createImageBitmapFn: decode, cryptoApi: webcrypto })).reason, 'metadata-mismatch');
});

test('model artifact requires a parsed scene with non-degenerate mesh geometry', async () => {
    const empty = makeGlb({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] });
    const valid = await validateDesignModelArtifactBlob(await triangleGlb());
    const degenerate = await validateDesignModelArtifactBlob(await triangleGlb([0, 0, 0, 0, 0, 0, 0, 0, 0]));
    const malformed = await validateDesignModelArtifactBlob(new Blob(['not glb'], { type: 'model/gltf-binary' }));
    const emptyScene = await validateDesignModelArtifactBlob(empty);
    assert.equal(valid.valid, true, JSON.stringify(valid));
    assert.equal(valid.meshCount, 1);
    const expectedModelSha = Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', await (await triangleGlb()).arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
    assert.equal(valid.sha256, expectedModelSha);
    assert.equal(degenerate.valid, false);
    assert.equal(degenerate.reason, 'invalid-geometry');
    assert.equal(emptyScene.valid, false);
    assert.equal(emptyScene.reason, 'empty-scene');
    assert.equal(malformed.valid, false);
    assert.equal(malformed.reason, 'parse-failed');
    assert.equal((await validateDesignModelArtifactBlob(new Blob([await triangleGlb().arrayBuffer()], { type: 'application/octet-stream' }))).valid, false);
});
