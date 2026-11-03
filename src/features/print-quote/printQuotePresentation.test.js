import assert from 'node:assert/strict';
import test from 'node:test';
import { getDimensionScalePercentages, getPrintDraftDimensions, isValidPrintDraft, scalePrintDimensions } from './printQuotePresentation.js';

const validDraft = {
    id: 'generated-1',
    title: 'Test model',
    modelUrl: '/private/generated-1.glb',
    dimensions: '60 × 40 × 20 mm',
    partColors: { body: '#d991ad' },
    modelScale: { x: 100, y: 100, z: 100 },
};

test('accepts a print draft with a model reference and positive dimensions', () => {
    assert.equal(isValidPrintDraft(validDraft), true);
    assert.deepEqual(getPrintDraftDimensions(validDraft.dimensions, validDraft.modelScale), { x: 60, y: 40, z: 20 });
});

test('AI Studio scale of 100 percent and 150 percent is applied to the raw model dimensions', () => {
    assert.deepEqual(getPrintDraftDimensions('60 × 40 × 20 mm', { x: 100, y: 100, z: 100 }), { x: 60, y: 40, z: 20 });
    assert.deepEqual(getPrintDraftDimensions('60 × 40 × 20 mm', { x: 150, y: 150, z: 150 }), { x: 90, y: 60, z: 30 });
});

test('non-uniform AI Studio scale is retained independently for each axis', () => {
    assert.deepEqual(getPrintDraftDimensions('60 × 40 × 20 mm', { x: 150, y: 50, z: 200 }), { x: 90, y: 20, z: 40 });
});

test('rejects missing model references and malformed or non-positive dimensions', () => {
    assert.equal(isValidPrintDraft(null), false);
    assert.equal(isValidPrintDraft({ ...validDraft, modelUrl: '' }), false);
    assert.equal(isValidPrintDraft({ ...validDraft, dimensions: 'unknown' }), false);
    assert.equal(isValidPrintDraft({ ...validDraft, dimensions: '60 × 0 × 20 mm' }), false);
    assert.equal(isValidPrintDraft({ ...validDraft, dimensions: '-60 × 40 × 20 mm' }), false);
    assert.equal(isValidPrintDraft({ ...validDraft, parts: 'not-an-array' }), false);
    assert.equal(isValidPrintDraft({ ...validDraft, modelScale: { x: -1 } }), false);
});

test('dimension changes preserve the original proportions and reject non-numeric values', () => {
    const aiStudioSnapshot = getPrintDraftDimensions('60 × 40 × 20 mm', { x: 150, y: 50, z: 200 });
    const printQuoteDimensions = scalePrintDimensions(aiStudioSnapshot, 'x', 180);
    assert.deepEqual(printQuoteDimensions, { x: 180, y: 40, z: 80 });
    assert.deepEqual(getDimensionScalePercentages(aiStudioSnapshot, printQuoteDimensions), { x: 200, y: 200, z: 200 });
    assert.deepEqual(scalePrintDimensions({ x: 60, y: 40, z: 20 }, 'y', 'nope'), { x: 60, y: 40, z: 20 });
});
