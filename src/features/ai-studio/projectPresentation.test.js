import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
    buildMultiDesignProjectRequest,
    buildTextDesignProjectRequest,
    claimDesignProjectSave,
    classifyDesignProjectIdempotencyRecord,
    classifyDesignProjectRequestError,
    createDesignProjectIdempotencyRecord,
    createMultiDesignProjectIdempotencyRecord,
    getCreatedDesignProjectId,
    getDesignProjectRequestFingerprint,
    getMultiDesignProjectRequestFingerprint,
    isLegacyMultiDesignProjectIdempotencyRecord,
    getDesignProjectStateForOwner,
    parseDesignProjectIdempotencyRecord,
    resolveDesignProject,
    releaseDesignProjectSave,
} from './projectPresentation.js';
import * as projectPresentation from './projectPresentation.js';

test('text project payload contains only the confirmed contract fields', () => {
    const result = buildTextDesignProjectRequest({
        productType: 'keychain',
        keychainVariant: 'click',
        styleId: 'mini-chibi',
        originalIdea: '  A tiny moon rabbit  ',
        quality: 'High',
        inputMode: 'multi',
        images: ['ignored-image'],
    });

    assert.deepEqual(result, {
        error: null,
        data: {
            productType: 'keychain',
            keychainVariant: 'click',
            styleId: 'mini-chibi',
            inputMode: 'text',
            originalIdea: 'A tiny moon rabbit',
        },
    });
});

test('non-keychain text projects omit keychainVariant', () => {
    const result = buildTextDesignProjectRequest({
        productType: 'night-light', keychainVariant: 'click', styleId: 'minimalist-glow', originalIdea: 'A small bedside light',
    });

    assert.deepEqual(result.data, {
        productType: 'night-light', styleId: 'minimalist-glow', inputMode: 'text', originalIdea: 'A small bedside light',
    });
});

test('text project request validation distinguishes missing product, style, variant, and idea', () => {
    const base = { productType: 'figure', styleId: 'chibi-collectible', originalIdea: 'A figure' };
    assert.equal(buildTextDesignProjectRequest({ ...base, productType: null }).error, 'product');
    assert.equal(buildTextDesignProjectRequest({ ...base, styleId: '' }).error, 'style');
    assert.equal(buildTextDesignProjectRequest({ ...base, originalIdea: '  ' }).error, 'idea');
    assert.equal(buildTextDesignProjectRequest({ ...base, productType: 'keychain', keychainVariant: 'unknown', styleId: 'cute-mascot' }).error, 'keychainVariant');
    assert.equal(buildTextDesignProjectRequest({ ...base, productType: 'keychain', keychainVariant: 'ordinary', styleId: 'mini-chibi' }).error, 'style');
    assert.equal(buildTextDesignProjectRequest({ ...base, originalIdea: 'x'.repeat(4001) }).error, 'idea-too-long');
});

test('image project request includes only confirmed fields and treats originalIdea as optional', async () => {
    const { buildImageDesignProjectRequest } = await import('./projectPresentation.js');
    assert.equal(typeof buildImageDesignProjectRequest, 'function');
    assert.deepEqual(buildImageDesignProjectRequest({
        productType: 'keychain', keychainVariant: 'click', styleId: 'mini-chibi', originalIdea: '  A tiny rabbit  ', quality: 'High',
    }), {
        error: null,
        data: { productType: 'keychain', keychainVariant: 'click', styleId: 'mini-chibi', inputMode: 'image', originalIdea: 'A tiny rabbit' },
    });
    assert.deepEqual(buildImageDesignProjectRequest({
        productType: 'figure', styleId: 'chibi-collectible', originalIdea: '  ',
    }).data, { productType: 'figure', styleId: 'chibi-collectible', inputMode: 'image' });
    assert.equal(buildImageDesignProjectRequest({
        productType: 'figure', styleId: 'chibi-collectible', originalIdea: 'x'.repeat(4001),
    }).error, 'idea-too-long');
});

test('image SHA-256 identifies file bytes regardless of filename', async () => {
    const { getImageContentSha256 } = await import('./projectPresentation.js');
    assert.equal(typeof getImageContentSha256, 'function');
    const first = new File(['abc'], 'same-name.png', { type: 'image/png' });
    const sameBytes = new File(['abc'], 'renamed.png', { type: 'image/png' });
    const changedBytes = new File(['abd'], 'same-name.png', { type: 'image/png' });
    assert.equal(await getImageContentSha256(first), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(await getImageContentSha256(first), await getImageContentSha256(sameBytes));
    assert.notEqual(await getImageContentSha256(first), await getImageContentSha256(changedBytes));
});

test('MULTI project request aligns two, four and eight files with deterministic slot metadata', () => {
    const fileFor = (slotId) => new File([slotId], `${slotId}.png`, { type: 'image/png' });
    for (const [expectedSlots, expectedHints] of [
        [['front', 'back'], ['front', 'back']],
        [['front', 'left', 'right', 'back'], ['front', 'left', 'right', 'back']],
        [['front', 'left', 'right', 'back', 'extra-1', 'extra-2', 'extra-3', 'extra-4'], ['front', 'left', 'right', 'back', null, null, null, null]],
    ]) {
        const uploads = [...expectedSlots].reverse().map((slotId) => ({ slotId, file: fileFor(slotId) }));
        const result = buildMultiDesignProjectRequest({
            productType: 'figure', styleId: 'chibi-collectible', originalIdea: ' A small fox ', uploads,
        });
        assert.equal(result.error, null);
        assert.deepEqual(result.data, {
            productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi', originalIdea: 'A small fox',
            clientSlots: expectedSlots, viewHints: expectedHints,
        });
        assert.deepEqual(result.files.map((file) => file.name), expectedSlots.map((slotId) => `${slotId}.png`));
    }
});

test('MULTI project request rejects fewer than two, more than eight, and duplicate or unknown slots', () => {
    const uploads = ['front', 'left', 'right', 'back', 'extra-1', 'extra-2', 'extra-3', 'extra-4', 'extra-5']
        .map((slotId) => ({ slotId, file: new File([slotId], `${slotId}.png`, { type: 'image/png' }) }));
    const base = { productType: 'figure', styleId: 'chibi-collectible' };
    assert.equal(buildMultiDesignProjectRequest({ ...base, uploads: uploads.slice(0, 1) }).error, 'image-count');
    assert.equal(buildMultiDesignProjectRequest({ ...base, uploads }).error, 'image-count');
    assert.equal(buildMultiDesignProjectRequest({ ...base, uploads: [uploads[0], uploads[0]] }).error, 'slots');
    assert.equal(buildMultiDesignProjectRequest({ ...base, uploads: [uploads[0], uploads[8]] }).error, 'slots');
});

test('MULTI v3 idempotency changes with slot metadata or image digest and reuses an unchanged request key', async () => {
    const data = {
        productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi',
        clientSlots: ['front', 'left'], viewHints: ['front', 'left'],
    };
    const imageHashes = [{ slotId: 'front', sha256: 'a'.repeat(64) }, { slotId: 'left', sha256: 'b'.repeat(64) }];
    const first = await createMultiDesignProjectIdempotencyRecord(data, null, () => 'multi-key-1', imageHashes);
    assert.deepEqual(await createMultiDesignProjectIdempotencyRecord(data, first, () => 'unused', imageHashes), first);
    assert.notEqual((await createMultiDesignProjectIdempotencyRecord(data, first, () => 'changed-image-key', [{ ...imageHashes[0], sha256: 'c'.repeat(64) }, imageHashes[1]])).key, first.key);
    assert.notEqual((await createMultiDesignProjectIdempotencyRecord({ ...data, clientSlots: ['left', 'front'], viewHints: ['left', 'front'] }, first, () => 'changed-slot-key', [...imageHashes].reverse())).key, first.key);
    assert.notEqual((await createMultiDesignProjectIdempotencyRecord({ ...data, originalIdea: 'changed' }, first, () => 'changed-idea-key', imageHashes)).key, first.key);
});

test('MULTI known FNV collision inputs produce different v3 identities and legacy record stays recognizable', async () => {
    const data = {
        productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi',
        clientSlots: ['front', 'left', 'right', 'back'],
        viewHints: ['front', 'left', 'right', 'back'],
    };
    const digests = [
        { slotId: 'front', sha256: 'a'.repeat(64) }, { slotId: 'left', sha256: 'b'.repeat(64) },
        { slotId: 'right', sha256: 'c'.repeat(64) }, { slotId: 'back', sha256: 'd'.repeat(64) },
    ];
    const first = { ...data, originalIdea: '01sggn40nv5snx' };
    const second = { ...data, originalIdea: '0kkgyv11hjcdre' };
    const firstFingerprint = await getMultiDesignProjectRequestFingerprint(first, digests);
    const secondFingerprint = await getMultiDesignProjectRequestFingerprint(second, digests);
    assert.notEqual(firstFingerprint, secondFingerprint);
    assert.notEqual(
        (await createMultiDesignProjectIdempotencyRecord(first, null, () => 'key-a', digests)).key,
        (await createMultiDesignProjectIdempotencyRecord(second, null, () => 'key-b', digests)).key,
    );
    assert.equal(isLegacyMultiDesignProjectIdempotencyRecord({ key: 'old', fingerprint: '11iv3we-405' }), true);
    assert.equal(isLegacyMultiDesignProjectIdempotencyRecord({ key: 'new', fingerprint: firstFingerprint }), false);
});

test('MULTI v3 SHA-256 identity persists only a versioned digest and reuses the same key', async () => {
    const idea = ['checkpoint', 'private', 'idea'].join('-');
    const data = {
        productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi', originalIdea: idea,
        clientSlots: ['front', 'left'], viewHints: ['front', 'left'],
    };
    const hashes = [{ slotId: 'front', sha256: 'a'.repeat(64) }, { slotId: 'left', sha256: 'b'.repeat(64) }];
    const fingerprint = await getMultiDesignProjectRequestFingerprint(data, hashes);
    assert.match(fingerprint, /^multi-v3-sha256:[a-f0-9]{64}$/);
    assert.equal(await getMultiDesignProjectRequestFingerprint(data, hashes), fingerprint);
    const canonical = JSON.stringify({
        data: {
            clientSlots: ['front', 'left'], inputMode: 'multi', originalIdea: idea,
            productType: 'figure', styleId: 'chibi-collectible', viewHints: ['front', 'left'],
        },
        imageHashes: [
            { sha256: 'a'.repeat(64), slotId: 'front' },
            { sha256: 'b'.repeat(64), slotId: 'left' },
        ],
    });
    assert.equal(fingerprint, `multi-v3-sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`);

    const first = await createMultiDesignProjectIdempotencyRecord(data, null, () => 'multi-v3-key', hashes);
    const second = await createMultiDesignProjectIdempotencyRecord(data, first, () => 'unused-key', hashes);
    assert.deepEqual(second, first);
    assert.equal(JSON.stringify(first).includes(idea), false);
});

test('MULTI v3 identity changes with idea, image bytes, slot order, product and style', async () => {
    const data = {
        productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi',
        originalIdea: ['same', 'identity'].join('-'), clientSlots: ['front', 'left'], viewHints: ['front', 'left'],
    };
    const hashes = [{ slotId: 'front', sha256: 'a'.repeat(64) }, { slotId: 'left', sha256: 'b'.repeat(64) }];
    const original = await getMultiDesignProjectRequestFingerprint(data, hashes);
    assert.notEqual(await getMultiDesignProjectRequestFingerprint({ ...data, originalIdea: 'changed' }, hashes), original);
    assert.notEqual(await getMultiDesignProjectRequestFingerprint(data, [{ ...hashes[0], sha256: 'c'.repeat(64) }, hashes[1]]), original);
    assert.notEqual(await getMultiDesignProjectRequestFingerprint(data, [{ ...hashes[1], slotId: 'front' }, { ...hashes[0], slotId: 'left' }]), original);
    assert.notEqual(await getMultiDesignProjectRequestFingerprint({ ...data, clientSlots: ['left', 'front'], viewHints: ['left', 'front'] }, [...hashes].reverse()), original);
    assert.notEqual(await getMultiDesignProjectRequestFingerprint({ ...data, productType: 'night-light' }, hashes), original);
    assert.notEqual(await getMultiDesignProjectRequestFingerprint({ ...data, styleId: 'anime-figure' }, hashes), original);
});

test('MULTI v3 rejects legacy and unknown saved records for manual reconciliation', async () => {
    const data = { productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi', clientSlots: ['front', 'left'], viewHints: ['front', 'left'] };
    const hashes = [{ slotId: 'front', sha256: 'a'.repeat(64) }, { slotId: 'left', sha256: 'b'.repeat(64) }];
    for (const savedRecord of [
        { key: 'old-fnv', fingerprint: '11iv3we-405' },
        { key: 'old-v2', fingerprint: 'multi-v2:{"idea":"private"}' },
        { key: 'unknown', fingerprint: 'unrecognized' },
    ]) {
        await assert.rejects(createMultiDesignProjectIdempotencyRecord(data, savedRecord, () => 'new-key', hashes));
    }
});

test('MULTI digest failure or incomplete image hashes fails closed', async () => {
    const data = { productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi', clientSlots: ['front', 'left'], viewHints: ['front', 'left'] };
    const hashes = [{ slotId: 'front', sha256: 'a'.repeat(64) }, { slotId: 'left', sha256: 'b'.repeat(64) }];
    await assert.rejects(getMultiDesignProjectRequestFingerprint(data, hashes, { subtle: { digest: async () => { throw new Error('digest unavailable'); } } }));
    await assert.rejects(getMultiDesignProjectRequestFingerprint(data, hashes.slice(0, 1)));
});

test('persisted Project record parser distinguishes absent, FNV, v2, v3 and malformed storage', () => {
    assert.deepEqual(parseDesignProjectIdempotencyRecord(null), { classification: 'none', record: null });
    assert.equal(classifyDesignProjectIdempotencyRecord({ key: 'old', fingerprint: '11iv3we-405' }), 'legacy-fnv');
    assert.equal(classifyDesignProjectIdempotencyRecord({ key: 'old', fingerprint: 'multi-v2:{}' }), 'legacy-multi-v2');
    assert.equal(classifyDesignProjectIdempotencyRecord({ key: 'new', fingerprint: `multi-v3-sha256:${'0'.repeat(64)}` }), 'multi-v3');
    assert.deepEqual(parseDesignProjectIdempotencyRecord('{broken'), { classification: 'unknown', record: null });
    assert.equal(classifyDesignProjectIdempotencyRecord({ key: '', fingerprint: 'multi-v3-sha256:bad' }), 'unknown');
});

test('project identifiers are accepted only from non-empty backend response fields', () => {
    assert.equal(getCreatedDesignProjectId({ id: 'project-123' }), 'project-123');
    assert.equal(getCreatedDesignProjectId({ projectId: ' project-456 ' }), 'project-456');
    assert.equal(getCreatedDesignProjectId({ id: '' }), null);
    assert.equal(getCreatedDesignProjectId({}), null);
});

test('an unclear create can reuse its key for the same payload but edits get a new key', () => {
    const data = { originalIdea: 'A desk lamp' };
    const first = createDesignProjectIdempotencyRecord(data, null, () => 'first-key');
    assert.deepEqual(createDesignProjectIdempotencyRecord(data, first, () => 'second-key'), first);
    assert.equal(createDesignProjectIdempotencyRecord({ originalIdea: 'A table lamp' }, first, () => 'edited-key').key, 'edited-key');
    assert.equal(getDesignProjectRequestFingerprint(data), first.fingerprint);
    assert.notEqual(getDesignProjectRequestFingerprint({ originalIdea: 'A table lamp' }), first.fingerprint);
});

test('an image with changed bytes cannot reuse the prior idempotency key', () => {
    const data = { productType: 'figure', styleId: 'chibi-collectible', inputMode: 'image' };
    const first = createDesignProjectIdempotencyRecord(data, null, () => 'first-image-key', 'sha256-a');
    assert.deepEqual(createDesignProjectIdempotencyRecord(data, first, () => 'unused-key', 'sha256-a'), first);
    assert.equal(createDesignProjectIdempotencyRecord(data, first, () => 'changed-image-key', 'sha256-b').key, 'changed-image-key');
});

test('a project saved under another account is hidden until the current account reads it', () => {
    const previousOwner = {
        ownerKey: 'account-a:session-1', phase: 'loaded', projectId: 'private-a',
        project: { projectId: 'private-a' }, message: '',
    };
    assert.deepEqual(getDesignProjectStateForOwner(previousOwner, 'account-b:session-2'), {
        ownerKey: 'account-b:session-2', phase: 'idle', projectId: '', project: null, message: '',
    });
    assert.equal(getDesignProjectStateForOwner(previousOwner, 'account-a:session-1'), previousOwner);
});

test('a second save for the same account is rejected while the first save is in flight', () => {
    const inFlightOwners = new Set();
    assert.equal(claimDesignProjectSave(inFlightOwners, 'account-a'), true);
    assert.equal(claimDesignProjectSave(inFlightOwners, 'account-a'), false);
    assert.equal(claimDesignProjectSave(inFlightOwners, 'account-b'), true);
    releaseDesignProjectSave(inFlightOwners, 'account-a');
    assert.equal(claimDesignProjectSave(inFlightOwners, 'account-a'), true);
});

test('project display data requires confirmed product, style, status, and idea fields', () => {
    const project = {
        productType: 'keychain', keychainVariant: 'ordinary', styleId: 'cute-mascot',
        inputMode: 'text', status: 'DRAFT', originalIdea: 'A cat keychain', ignoredLocalField: 'not displayed',
    };
    assert.deepEqual(resolveDesignProject(project, 'project-123'), {
        projectId: 'project-123', productType: 'keychain', keychainVariant: 'ordinary',
        styleId: 'cute-mascot', inputMode: 'text', status: 'DRAFT', inputs: [], originalIdea: 'A cat keychain',
    });
    assert.equal(resolveDesignProject({ ...project, styleId: 'invented-style' }, 'project-123'), null);
    assert.equal(resolveDesignProject({ ...project, status: null }, 'project-123'), null);
    assert.equal(resolveDesignProject({ ...project, originalIdea: null }, 'project-123'), null);
    assert.equal(resolveDesignProject({ ...project, projectId: 'project-other' }, 'project-123'), null);
});

test('an IMAGE Project without originalIdea remains readable without restoring an image file', () => {
    const project = resolveDesignProject({
        productType: 'figure', styleId: 'chibi-collectible', inputMode: 'image', status: 'DRAFT',
    }, 'image-project-1');
    assert.deepEqual(project, {
        projectId: 'image-project-1', productType: 'figure', styleId: 'chibi-collectible', inputMode: 'image', status: 'DRAFT', inputs: [],
    });
    assert.equal(Object.hasOwn(project, 'originalIdea'), false);
    assert.deepEqual(resolveDesignProject({
        productType: 'figure', styleId: 'chibi-collectible', inputMode: 'image', status: 'DRAFT', originalIdea: null,
    }, 'image-project-2'), {
        projectId: 'image-project-2', productType: 'figure', styleId: 'chibi-collectible', inputMode: 'image', status: 'DRAFT', inputs: [],
    });
});

test('a MULTI Project reads confirmed slot metadata without requiring local files', () => {
    assert.deepEqual(resolveDesignProject({
        productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi', status: 'DRAFT',
        clientSlots: ['front', 'extra-1'], viewHints: ['front', null],
    }, 'multi-project-1'), {
        projectId: 'multi-project-1', productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi', status: 'DRAFT',
        inputs: [], clientSlots: ['front', 'extra-1'], viewHints: ['front', null],
    });
    assert.deepEqual(resolveDesignProject({
        productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi', status: 'DRAFT',
    }, 'multi-project-2'), {
        projectId: 'multi-project-2', productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi', status: 'DRAFT', inputs: [],
    });
});

test('Project input summaries are validated and preserve Backend slot metadata', () => {
    const input = {
        inputId: 'input-1', order: 0, mimeType: 'image/png', byteSize: 4,
        sha256: 'a'.repeat(64), clientSlot: 'front', viewHint: 'front',
    };
    assert.deepEqual(resolveDesignProject({
        productType: 'figure', styleId: 'chibi-collectible', inputMode: 'image', status: 'DRAFT', inputs: [input],
    }, 'image-project'), {
        projectId: 'image-project', productType: 'figure', styleId: 'chibi-collectible', inputMode: 'image', status: 'DRAFT', inputs: [input],
    });
    const multiInputs = [input, { ...input, inputId: 'input-2', order: 1, clientSlot: 'left', viewHint: 'left' }];
    assert.deepEqual(resolveDesignProject({
        productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi', status: 'DRAFT', inputs: multiInputs,
    }, 'multi-project'), {
        projectId: 'multi-project', productType: 'figure', styleId: 'chibi-collectible', inputMode: 'multi', status: 'DRAFT',
        inputs: multiInputs, clientSlots: ['front', 'left'], viewHints: ['front', 'left'],
    });
    assert.equal(resolveDesignProject({
        productType: 'figure', styleId: 'chibi-collectible', inputMode: 'image', status: 'DRAFT', inputs: [{ ...input, sha256: 'invalid' }],
    }, 'invalid-project'), null);
});

test('restored Project input Blob must match the Backend MIME type and byte size', () => {
    const input = { mimeType: 'image/png', byteSize: 4 };
    const matchesBlob = projectPresentation.hasMatchingProjectInputBlob;
    assert.equal(typeof matchesBlob, 'function');
    assert.equal(matchesBlob(new Blob([new Uint8Array(4)], { type: 'image/png' }), input), true);
    assert.equal(matchesBlob(new Blob([new Uint8Array(4)], { type: 'image/jpeg' }), input), false);
    assert.equal(matchesBlob(new Blob([new Uint8Array(3)], { type: 'image/png' }), input), false);
    assert.equal(matchesBlob(new Blob([new Uint8Array(4)], { type: 'image/png; charset=binary' }), input), true);
    assert.equal(matchesBlob(null, input), false);
});

test('project request errors distinguish auth rejection from an unknown result', () => {
    assert.deepEqual(classifyDesignProjectRequestError({ response: { status: 401 } }), { outcome: 'rejected', code: 'unauthenticated' });
    assert.deepEqual(classifyDesignProjectRequestError({ response: { status: 403 } }), { outcome: 'rejected', code: 'forbidden' });
    assert.deepEqual(classifyDesignProjectRequestError({ response: { status: 422 } }), { outcome: 'rejected', code: 'backend' });
    assert.deepEqual(classifyDesignProjectRequestError({ code: 'ECONNABORTED' }), { outcome: 'indeterminate', code: 'unknown' });
    assert.deepEqual(classifyDesignProjectRequestError({ code: 'ERR_NETWORK' }), { outcome: 'indeterminate', code: 'unknown' });
    assert.deepEqual(classifyDesignProjectRequestError({ response: { status: 503 } }), { outcome: 'indeterminate', code: 'unknown' });
});
