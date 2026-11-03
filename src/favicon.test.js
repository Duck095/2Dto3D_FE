import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const faviconPath = new URL('./assets/approved-3d-keychain-logo.webp', import.meta.url);

test('the document points to the approved keychain logo favicon', async () => {
    assert.match(html, /<link\s+rel="icon"\s+type="image\/webp"\s+href="\/src\/assets\/approved-3d-keychain-logo\.webp"\s*\/>/);
    const favicon = await readFile(faviconPath, 'utf8');
    assert.equal(favicon.slice(0, 4), 'RIFF');
    assert.equal(favicon.slice(8, 12), 'WEBP');
});

test('production continues to exclude the public directory from Vite copying', async () => {
    const viteConfig = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
    assert.match(viteConfig, /publicDir:\s*command\s*===\s*'build'\s*\?\s*false\s*:\s*'public'/);
});
