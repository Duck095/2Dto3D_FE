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

test('local launch scripts share the backend port and explicitly disable migrations', () => {
    const runAll = readFileSync(new URL('../../run-all.sh', import.meta.url), 'utf8');
    const runBackend = readFileSync(new URL('../../../2Dto3D_BE/run-local.sh', import.meta.url), 'utf8');
    const backendEnv = readFileSync(new URL('../../../2Dto3D_BE/dev-env.sh', import.meta.url), 'utf8');
    const cacheRegression = readFileSync(new URL('../../../2Dto3D_BE/tests/maven-wrapper-cache-test.sh', import.meta.url), 'utf8');
    const localProfile = readFileSync(new URL('../../../2Dto3D_BE/src/main/resources/application-local.properties', import.meta.url), 'utf8');

    assert.match(runAll, /BACKEND_PORT="\$\{BACKEND_PORT:-8080\}"/);
    assert.match(runAll, /run-local\.sh/);
    assert.match(runAll, /api\/auth\/ping/);
    assert.match(runBackend, /mvnw spring-boot:run/);
    assert.match(runBackend, /java -version/);
    assert.match(runBackend, /will not download software/);
    assert.match(runBackend, /maven_wrapper_is_cached/);
    assert.match(backendEnv, /wrapper\/dists\/%s\/%s/);
    assert.match(cacheRegression, /mktemp -d/);
    assert.match(cacheRegression, /obsolete extra distribution directory/);
    assert.match(backendEnv, /DB_URL must point to a loopback PostgreSQL host/);
    assert.match(runBackend, /--spring\.flyway\.enabled=false/);
    assert.match(runBackend, /--spring\.jpa\.hibernate\.ddl-auto=validate/);
    assert.match(localProfile, /^spring\.flyway\.enabled=false$/m);
    assert.match(localProfile, /localhost\.invalid/);
    assert.doesNotMatch(localProfile, /spring\.flyway\.enabled=true/);
});

test('run-all reuses a backend only when its live build fingerprint matches current source', () => {
    const runAll = readFileSync(new URL('../../run-all.sh', import.meta.url), 'utf8');
    const backendController = readFileSync(new URL('../../../2Dto3D_BE/src/main/java/com/exe/morphia3d/controller/AuthController.java', import.meta.url), 'utf8');

    assert.match(runAll, /APP_LOCAL_BUILD_ID/);
    assert.match(runAll, /sha256sum/);
    assert.match(runAll, /x-backend-build-id/i);
    assert.match(runAll, /existing_backend_body=.*api\/auth\/ping[\s\S]*?if \[\[ -n "\$existing_backend_pid" \|\| "\$existing_backend_body" == "ok" \]\]/);
    assert.match(runAll, /does not match current source|stale or unverified/);
    assert.match(backendController, /X-Backend-Build-Id/);
    assert.match(backendController, /app\.local-build-id/);
});
