import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('./NotFoundPage.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('./not-found.css', import.meta.url), 'utf8').catch(() => '');
const routes = await readFile(new URL('../routes/AppRoutes.jsx', import.meta.url), 'utf8');

test('404 page uses a semantic section and Pocket Joy presentation', () => {
    assert.match(page, /<section\b[^>]*className="not-found-page"[^>]*aria-labelledby=/);
    assert.match(page, /className="not-found-page__card"/);
    assert.match(page, /<h1[^>]*>\s*404\s*<\/h1>/);
    assert.match(page, /Cream|Pocket Joy|Không tìm thấy trang|Trang không tồn tại/);
    assert.match(styles, /background:\s*var\(--joy-paper\)/);
    assert.match(styles, /background:\s*var\(--joy-surface\)/);
    assert.match(styles, /var\(--joy-ink\)/);
});

test('404 page preserves home and marketplace navigation with visible keyboard focus', () => {
    assert.match(page, /<Link\s+to="\/"/);
    assert.match(page, /<Link\s+to="\/marketplace"/);
    assert.match(styles, /\.not-found-page__actions\s+a:focus-visible/);
    assert.match(styles, /outline:/);
});

test('404 layout adapts action buttons and card spacing to narrow viewports', () => {
    assert.match(styles, /@media\s*\(max-width:\s*767px\)/);
    assert.match(styles, /@media\s*\(max-width:\s*420px\)/);
    assert.match(styles, /flex-wrap:\s*wrap/);
    assert.match(styles, /width:\s*100%/);
});

test('home stays the only index route and unknown URLs use the existing catch-all', () => {
    assert.match(routes, /\{\s*index:\s*true,\s*element:\s*<HomePage\s*\/>\s*\}/);
    assert.match(routes, /\{\s*path:\s*'\*',\s*element:\s*<NotFoundPage\s*\/>\s*\}/);
    assert.doesNotMatch(routes, /home-preview|preview-home/i);
});
