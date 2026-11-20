import assert from 'node:assert/strict';
import test from 'node:test';
import { getNextStudioInputMode, getStudioInputMode } from './inputMode.js';

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

test('studio input tabs wrap with arrow keys and support Home and End', () => {
    const modes = ['text', 'image', 'multi'];
    assert.equal(getNextStudioInputMode('text', 'ArrowLeft', modes), 'multi');
    assert.equal(getNextStudioInputMode('multi', 'ArrowRight', modes), 'text');
    assert.equal(getNextStudioInputMode('text', 'ArrowRight', modes), 'image');
    assert.equal(getNextStudioInputMode('image', 'Home', modes), 'text');
    assert.equal(getNextStudioInputMode('image', 'End', modes), 'multi');
    assert.equal(getNextStudioInputMode('image', 'Enter', modes), null);
});
