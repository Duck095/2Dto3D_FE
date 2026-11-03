import assert from 'node:assert/strict';
import test from 'node:test';
import * as presentation from './generationPresentation.js';
import { clearPendingGenerationState, createGenerationResultsState, generationResultsReducer, getConfirmedGenerationMetadata, getGenerationOwnerKey, getGenerationResultsForOwner, hasCustomizableParts, persistPendingGenerationState, restorePendingGenerationState } from './generationPresentation.js';

test('customization is available only when a generated model has parts', () => {
    assert.equal(hasCustomizableParts({ parts: [{ id: 'part-1' }] }), true);
    assert.equal(hasCustomizableParts({ parts: [] }), false);
    assert.equal(hasCustomizableParts({}), false);
    assert.equal(hasCustomizableParts(null), false);
});

test('only metadata supplied by the generation response is presented', () => {
    assert.deepEqual(getConfirmedGenerationMetadata({ format: 'GLB', faces: 0 }), [
        ['Format', 'GLB'],
        ['Faces', 0],
    ]);
    assert.deepEqual(getConfirmedGenerationMetadata({}), []);
});

test('empty or malformed generation responses are not treated as completed models', () => {
    assert.equal(presentation.resolveGenerationResponse?.(null)?.state, 'invalid');
    assert.equal(presentation.resolveGenerationResponse?.({})?.state, 'invalid');
    assert.equal(presentation.resolveGenerationResponse?.([])?.state, 'invalid');
    assert.equal(presentation.resolveGenerationResponse?.({ status: 'completed', modelUrl: ' ' })?.state, 'invalid');
    assert.equal(presentation.resolveGenerationResponse?.({ status: 'success', modelUrl: '/model.glb' })?.state, 'invalid');
});

test('queued and processing responses remain pending without exposing a model', () => {
    for (const status of ['queued', 'processing']) {
        const result = presentation.resolveGenerationResponse?.({ status, modelUrl: '/model.glb' });
        assert.equal(result?.state, 'pending');
        assert.equal(result?.generation, null);
    }
});

test('pending generation blocks submission until an explicit new-request action', () => {
    const pending = presentation.generationSubmissionReducer?.(presentation.initialGenerationSubmissionState, { type: 'pending' });
    assert.equal(pending?.status, 'pending');
    assert.equal(presentation.generationSubmissionReducer?.(pending, { type: 'submit' }), pending);

    const allowed = presentation.generationSubmissionReducer?.(pending, { type: 'allow-new-request' });
    assert.equal(allowed?.status, 'idle');
    assert.equal(allowed?.previousRequestMayStillRun, true);
    const submitting = presentation.generationSubmissionReducer?.(allowed, { type: 'submit' });
    assert.equal(submitting?.status, 'submitting');
    assert.equal(submitting?.previousRequestMayStillRun, true);
});

test('generation lifecycle preserves terminal states and prior-request warning', () => {
    const pending = presentation.generationSubmissionReducer?.(presentation.initialGenerationSubmissionState, { type: 'pending' });
    const allowed = presentation.generationSubmissionReducer?.(pending, { type: 'allow-new-request' });
    const completed = presentation.generationSubmissionReducer?.(allowed, { type: 'completed' });
    const failed = presentation.generationSubmissionReducer?.(allowed, { type: 'failed' });
    const invalid = presentation.generationSubmissionReducer?.(allowed, { type: 'invalid' });
    assert.equal(completed?.status, 'completed');
    assert.equal(failed?.status, 'failed');
    assert.equal(invalid?.status, 'invalid');
    assert.equal(completed?.previousRequestMayStillRun, true);
    assert.equal(failed?.previousRequestMayStillRun, true);
    assert.equal(invalid?.previousRequestMayStillRun, true);
    const indeterminate = presentation.generationSubmissionReducer?.(presentation.initialGenerationSubmissionState, { type: 'indeterminate' });
    assert.equal(indeterminate?.status, 'pending');
    assert.equal(indeterminate?.previousRequestMayStillRun, true);
});

test('pending state survives route remounts and retains the prior-request warning', () => {
    const values = new Map();
    const storage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
    };
    const ownerA = getGenerationOwnerKey?.({ email: 'A@example.com' });
    const ownerB = getGenerationOwnerKey?.({ email: 'b@example.com' });
    persistPendingGenerationState(storage, ownerA);
    assert.deepEqual(restorePendingGenerationState(storage, ownerA), {
        status: 'pending', previousRequestMayStillRun: false,
    });
    assert.equal(restorePendingGenerationState(storage, ownerB), null);
    persistPendingGenerationState(storage, ownerA, true);
    assert.deepEqual(restorePendingGenerationState(storage, ownerA), {
        status: 'pending', previousRequestMayStillRun: true,
    });
    clearPendingGenerationState(storage, ownerA);
    assert.equal(restorePendingGenerationState(storage, ownerA), null);
});

test('pending marker identity is stable per account and never uses the authentication token', () => {
    assert.equal(getGenerationOwnerKey?.({ email: ' A@example.com ' }), getGenerationOwnerKey?.({ email: 'a@example.com' }));
    assert.notEqual(getGenerationOwnerKey?.({ id: 12 }), getGenerationOwnerKey?.({ id: 13 }));
    assert.equal(getGenerationOwnerKey?.({ name: 'No identity' }), null);
});

test('failed generation responses remain failed and do not expose their model URL', () => {
    const result = presentation.resolveGenerationResponse?.({ status: 'failed', modelUrl: '/model.glb' });
    assert.equal(result?.state, 'failed');
    assert.equal(result?.generation, null);
});

test('only an explicit success response with a model URL is completed', () => {
    const input = { id: 12, status: 'completed', modelUrl: '/generated/model.glb', dimensions: '10 x 20 x 30 mm' };
    const result = presentation.resolveGenerationResponse?.(input);
    assert.equal(result?.state, 'completed');
    assert.equal(result?.generation?.modelUrl, '/generated/model.glb');
    assert.equal(result?.generation?.dimensions, input.dimensions);
});

test('generation model and history are hidden synchronously when the session owner changes or logs out', () => {
    const ownerA = getGenerationOwnerKey({ id: 'account-a' });
    const ownerB = getGenerationOwnerKey({ id: 'account-b' });
    const completed = { id: 22, status: 'completed', modelUrl: '/private/a.glb', dimensions: '10 x 20 x 30 mm' };
    const ownerAState = generationResultsReducer(createGenerationResultsState(ownerA), {
        type: 'completed', ownerKey: ownerA, generation: completed,
    });

    assert.equal(getGenerationResultsForOwner(ownerAState, ownerA).isGenerated, true);
    assert.equal(getGenerationResultsForOwner(ownerAState, ownerB).isGenerated, false);
    assert.equal(getGenerationResultsForOwner(ownerAState, ownerB).selectedGeneration, null);
    assert.deepEqual(getGenerationResultsForOwner(ownerAState, ownerB).history, []);
    assert.deepEqual(getGenerationResultsForOwner(ownerAState, 'anonymous').history, []);
});

test('late results from a previous owner cannot update the current generation session', () => {
    const ownerA = getGenerationOwnerKey({ id: 'account-a' });
    const ownerB = getGenerationOwnerKey({ id: 'account-b' });
    const current = createGenerationResultsState(ownerB);
    const next = generationResultsReducer(current, {
        type: 'completed', ownerKey: ownerA,
        generation: { id: 1, status: 'completed', modelUrl: '/private/a.glb', dimensions: '10 x 20 x 30 mm' },
    });
    assert.equal(next, current);
});

test('late results from an earlier login session cannot update a new session for the same account', () => {
    const accountKey = getGenerationOwnerKey({ id: 'same-account' });
    const priorSession = `${accountKey}:session-1`;
    const currentSession = `${accountKey}:session-2`;
    const current = createGenerationResultsState(currentSession);
    const next = generationResultsReducer(current, {
        type: 'completed', ownerKey: priorSession,
        generation: { id: 2, status: 'completed', modelUrl: '/old-session.glb', dimensions: '10 x 20 x 30 mm' },
    });

    assert.equal(next, current);
    assert.deepEqual(getGenerationResultsForOwner(createGenerationResultsState(priorSession), currentSession).history, []);
});

test('restored generation history accepts only completed models belonging to the current owner', () => {
    const ownerA = getGenerationOwnerKey({ id: 'account-a' });
    const ownerB = getGenerationOwnerKey({ id: 'account-b' });
    const completed = { id: 7, status: 'completed', modelUrl: '/private/a.glb', dimensions: '10 x 20 x 30 mm' };
    const pending = { id: 8, status: 'processing', modelUrl: '/private/pending.glb' };
    const initial = generationResultsReducer(createGenerationResultsState(ownerA), {
        type: 'completed', ownerKey: ownerA, generation: completed,
    });
    const selected = generationResultsReducer(initial, { type: 'select-history', ownerKey: ownerA, generation: initial.history[0] });
    assert.equal(selected.selectedGeneration.id, completed.id);

    const staleSelect = generationResultsReducer(initial, { type: 'select-history', ownerKey: ownerB, generation: initial.history[0] });
    const pendingSelect = generationResultsReducer(initial, { type: 'select-history', ownerKey: ownerA, generation: pending });
    assert.equal(staleSelect, initial);
    assert.equal(pendingSelect, initial);
});

test('Print Quote draft is created only from a completed model with valid source dimensions', () => {
    const completed = { id: 12, status: 'completed', title: 'Generated item', modelUrl: '/generated/model.glb', dimensions: '10 x 20 x 30 mm' };
    const pending = { ...completed, status: 'processing' };
    const missingDimensions = { ...completed, dimensions: undefined };
    const options = { productName: 'Generated item', partColors: {}, modelScale: { x: 100, y: 100, z: 100 } };

    assert.equal(presentation.createPrintDraftFromGeneration?.(pending, options), null);
    assert.equal(presentation.createPrintDraftFromGeneration?.(missingDimensions, options), null);
    assert.deepEqual(presentation.createPrintDraftFromGeneration?.(completed, options), {
        id: 12,
        title: 'Generated item',
        productName: 'Generated item',
        modelUrl: '/generated/model.glb',
        dimensions: '10 x 20 x 30 mm',
        partColors: {},
        modelScale: { x: 100, y: 100, z: 100 },
    });
});
