import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldRevalidateIdentityOn401 } from './auth401Policy.js';

test('login, registration, identity, and membership 401 responses do not trigger global logout handling', () => {
    for (const url of [
        '/auth/login',
        '/auth/register',
        '/auth/ping',
        '/v1/me',
        '/memberships/me',
        '/memberships/plans',
        '/memberships/community-downloads/12',
    ]) {
        assert.equal(shouldRevalidateIdentityOn401(url), false, url);
    }
});

test('other protected API 401 responses request canonical identity revalidation', () => {
    assert.equal(shouldRevalidateIdentityOn401('/admin/staff'), true);
    assert.equal(shouldRevalidateIdentityOn401('http://localhost:3000/api/orders?status=pending', '/api'), true);
});

test('base API paths and query strings are normalized before classification', () => {
    assert.equal(shouldRevalidateIdentityOn401('/api/v1/me?expand=staff', '/api'), false);
    assert.equal(shouldRevalidateIdentityOn401('http://localhost:3000/api/memberships/me', '/api'), false);
});
