import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import viteConfig from '../../vite.config.js';
import { resolveBackendPort } from './localBackendConfig.js';

test('backend port defaults to 8080 and accepts a local override', () => {
    assert.equal(resolveBackendPort(undefined), 8080);
    assert.equal(resolveBackendPort('18080'), 18080);
});

test('backend port rejects values outside the TCP port range', () => {
    for (const value of ['abc', '0', '65536', '8080.5', ' 8080 ']) {
        assert.throws(() => resolveBackendPort(value), /BACKEND_PORT/);
    }
});

test('Vite stays on 3000 and proxies API requests to the configured backend port', () => {
    const originalPort = process.env.BACKEND_PORT;

    try {
        delete process.env.BACKEND_PORT;
        const defaultConfig = viteConfig({ command: 'serve', mode: 'development' });
        assert.equal(defaultConfig.server.port, 3000);
        assert.equal(defaultConfig.server.proxy['/api'].target, 'http://127.0.0.1:8080');

        process.env.BACKEND_PORT = '18080';
        const overrideConfig = viteConfig({ command: 'serve', mode: 'development' });
        assert.equal(overrideConfig.server.port, 3000);
        assert.equal(overrideConfig.server.proxy['/api'].target, 'http://127.0.0.1:18080');
    } finally {
        if (originalPort === undefined) delete process.env.BACKEND_PORT;
        else process.env.BACKEND_PORT = originalPort;
    }
});

test('FE launcher shares its backend port and waits for the auth health check', () => {
    const runAll = readFileSync(new URL('../../run-all.sh', import.meta.url), 'utf8');

    assert.match(runAll, /BACKEND_PORT="\$\{BACKEND_PORT:-8080\}"/);
    assert.match(runAll, /run-local\.sh/);
    assert.match(runAll, /api\/auth\/ping/);
});
