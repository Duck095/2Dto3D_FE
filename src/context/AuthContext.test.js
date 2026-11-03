import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const context = await readFile(new URL('./AuthContext.jsx', import.meta.url), 'utf8');

test('restored session membership is marked unverified and not exposed as confirmed membership', () => {
    assert.match(context, /type: 'restore', membership: savedUser\.membership/);
    assert.match(context, /const restoredUser = \{ \.\.\.savedUser \};\s*delete restoredUser\.membership;\s*setUser\(restoredUser\)/);
    assert.match(context, /membership: membershipState\.membership/);
    assert.match(context, /membershipStatus: membershipState\.status/);
});

test('refresh failure clears membership freshness without clearing the authenticated user', () => {
    assert.match(context, /dispatchMembership\(\{ type: 'refresh-start' \}\)[\s\S]*?catch \{\s*if \(isCurrentMembershipRefresh\(request, currentRequest\(\)\)\) \{\s*dispatchMembership\(\{ type: 'refresh-failed' \}\);\s*\}\s*return null;/);
    const refreshImplementation = context.match(/const refreshMembership = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[storeMembership\]\);/)?.[1] || '';
    assert.doesNotMatch(refreshImplementation, /authStorage\.clear\(\)|setUser\(null\)/);
});

test('only server membership results can set membership to confirmed', () => {
    assert.match(context, /dispatchMembership\(\{ type: 'server-confirmed', membership: nextMembership \}\)/);
    assert.match(context, /MEMBERSHIP_API_SUPPORTED\s*\? \{ type: 'server-confirmed', membership: data\.membership \|\| null \}\s*: \{ type: 'unsupported' \}/);
});

test('login rejects a response without a confirmed token before storing a user or session', () => {
    const login = context.match(/const login = useCallback\(async \(data\) => \{([\s\S]*?)\n  \}, \[verifyCurrentUser\]\);/)?.[1] || '';
    assert.match(login, /if \(!data \|\| typeof data\.token !== 'string' \|\| !data\.token\.trim\(\) \|\| authStorage\.isTokenExpired\(data\.token\)\)\s*\{\s*throw new Error/);
    assert.ok(login.indexOf('throw new Error') < login.indexOf('authStorage.setToken(data.token)'));
    assert.ok(login.indexOf('throw new Error') < login.indexOf('setUser(data)'));
});

test('refresh success and failure both ignore stale requests, and login/logout invalidate pending work', () => {
    assert.match(context, /await getMyMembership\(\);\s*if \(!isCurrentMembershipRefresh\(request, currentRequest\(\)\)\) return null;\s*return storeMembership\(nextMembership\)/);
    assert.match(context, /catch \{\s*if \(isCurrentMembershipRefresh\(request, currentRequest\(\)\)\) \{\s*dispatchMembership\(\{ type: 'refresh-failed' \}\);/);
    const login = context.match(/const login = useCallback\(async \(data\) => \{([\s\S]*?)\n  \}, \[verifyCurrentUser\]\);/)?.[1] || '';
    const logout = context.match(/const logout = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[\]\);/)?.[1] || '';
    for (const sessionAction of [login, logout]) {
        assert.match(sessionAction, /membershipSessionVersion\.current \+= 1/);
        assert.match(sessionAction, /membershipRequestVersion\.current \+= 1/);
    }
});

test('internal identity is fetched from the backend after session restore and login without unsupported membership calls', () => {
    assert.match(context, /await getCurrentUser\(\)/);
    assert.match(context, /if \(MEMBERSHIP_API_SUPPORTED\) void refreshMembership\(\);\s*else dispatchMembership\(\{ type: 'unsupported' \}\);\s*void verifyCurrentUser\(\)\.finally/);
    const login = context.match(/const login = useCallback\(async \(data\) => \{([\s\S]*?)\n  \}, \[verifyCurrentUser\]\);/)?.[1] || '';
    assert.match(context, /const login = useCallback\(async \(data\) =>/);
    assert.match(context, /return verifyCurrentUser\(\)/);
    assert.doesNotMatch(login, /data\.role|ADMIN/);
});

test('membership refresh is gated by the explicit Backend capability flag', () => {
    const refreshImplementation = context.match(/const refreshMembership = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[storeMembership\]\);/)?.[1] || '';
    assert.match(refreshImplementation, /if \(!MEMBERSHIP_API_SUPPORTED\)[\s\S]*?dispatchMembership\(\{ type: 'unsupported' \}\)[\s\S]*?return null/);
    assert.match(context, /import \{ getMyMembership, MEMBERSHIP_API_SUPPORTED \}/);
});

test('current-user access state is separate from persisted login user and membership state', () => {
    assert.match(context, /currentUser: currentUserState\.currentUser/);
    assert.match(context, /currentUserStatus: currentUserState\.status/);
    assert.match(context, /isCurrentUserRequest\(request, currentRequest\(\)\)/);
    assert.match(context, /dispatchCurrentUser\(\{ type: 'logout' \}\)/);
});

test('only current-user 401 expires a session and stale requests cannot clear a newer session', () => {
    assert.match(context, /error\.response\?\.status === 401\) \{\s*expireSession\(\)/);
    assert.match(context, /if \(isCurrentUserRequest\(request, currentRequest\(\)\)\)/);
    assert.match(context, /window\.location\.replace\('\/login'\)/);
    assert.match(context, /hadStoredSession && typeof window/);
});

test('concurrent protected-endpoint 401s share one canonical identity verification', () => {
    assert.match(context, /currentUserVerificationInFlight = useRef\(null\)/);
    assert.match(context, /if \(inFlight && inFlight\.token === token[\s\S]*?return inFlight\.promise/);
    assert.match(context, /AUTH_IDENTITY_REVALIDATION_EVENT, revalidateIdentity/);
    assert.match(context, /await getCurrentUser\(\)/);
});

test('logout clears both stored credentials and auth state', () => {
    const logout = context.match(/const logout = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[\]\);/)?.[1] || '';
    assert.match(logout, /authStorage\.clear\(\)/);
    assert.match(logout, /setUser\(null\)/);
    assert.match(logout, /dispatchCurrentUser\(\{ type: 'logout' \}\)/);
    assert.match(logout, /dispatchMembership\(\{ type: 'logout' \}\)/);
});
