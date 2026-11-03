import assert from 'node:assert/strict';
import test from 'node:test';
import { validateStudioImage } from './uploadValidation.js';

test('accepts an image file without imposing an unconfirmed size limit', () => {
    assert.equal(validateStudioImage({ type: 'image/png', size: 11 * 1024 * 1024 }), null);
});

test('rejects non-image and missing file types', () => {
    assert.match(validateStudioImage({ type: 'application/pdf', size: 100 }), /hình ảnh/i);
    assert.match(validateStudioImage({ type: '', size: 100 }), /hình ảnh/i);
    assert.match(validateStudioImage(null), /hình ảnh/i);
});
