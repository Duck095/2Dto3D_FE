import assert from 'node:assert/strict';
import test from 'node:test';
import { getStudioInputMode } from './inputMode.js';

test('studio query selects the requested supported input mode', () => {
    assert.equal(getStudioInputMode('?mode=image'), 'image');
    assert.equal(getStudioInputMode('?mode=text'), 'text');
});

test('unsupported or missing modes default to text input', () => {
    assert.equal(getStudioInputMode('?mode=video'), 'text');
    assert.equal(getStudioInputMode(''), 'text');
});

test('model edit drafts take priority over URL mode and keep their original input', () => {
    assert.equal(getStudioInputMode('?mode=text', { imageDataUrl: 'data:image/png;base64,abc' }), 'image');
    assert.equal(getStudioInputMode('?mode=image', { prompt: 'small vase' }), 'text');
});
