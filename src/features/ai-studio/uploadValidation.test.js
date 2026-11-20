import assert from 'node:assert/strict';
import test from 'node:test';
import { validateStudioImage } from './uploadValidation.js';

test('accepts image files up to the confirmed 10 MiB limit', () => {
    assert.equal(validateStudioImage({ type: 'image/png', size: 10 * 1024 * 1024 }), null);
});

test('rejects non-image and missing file types', () => {
    assert.match(validateStudioImage({ type: 'application/pdf', size: 100 }), /hình ảnh/i);
    assert.match(validateStudioImage({ type: '', size: 100 }), /hình ảnh/i);
    assert.match(validateStudioImage(null), /hình ảnh/i);
});

test('rejects empty and over-limit image files', () => {
    assert.match(validateStudioImage({ type: 'image/png', size: 0 }), /trống/i);
    assert.match(validateStudioImage({ type: 'image/png', size: 10 * 1024 * 1024 + 1 }), /10 MiB/i);
});
