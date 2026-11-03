import assert from 'node:assert/strict';
import test from 'node:test';
import { getMembershipPlanId, getPricingMembershipState, initialMembershipFreshness, isCurrentMembershipRefresh, membershipFreshnessReducer } from './membershipPresentation.js';

test('membership loading and unauthenticated states are explicit', () => {
    assert.equal(getPricingMembershipState({ isLoading: true, isAuthenticated: false, membership: null }), 'loading');
    assert.equal(getPricingMembershipState({ isLoading: false, isAuthenticated: false, membership: null }), 'unauthenticated');
});

test('current plan is shown only when AuthContext supplies a recognized membership plan', () => {
    assert.equal(getMembershipPlanId({ plan: 'PRO' }), 'PRO');
    assert.equal(getMembershipPlanId({ plan: ' premium ' }), 'PREMIUM');
    assert.equal(getPricingMembershipState({ isLoading: false, isAuthenticated: true, membership: { plan: 'FREE' }, membershipStatus: 'confirmed' }), 'current');
    assert.equal(getPricingMembershipState({ isLoading: false, isAuthenticated: true, membership: null }), 'unavailable');
    assert.equal(getPricingMembershipState({ isLoading: false, isAuthenticated: true, membership: { plan: 'GOLD' } }), 'unavailable');
    assert.equal(getMembershipPlanId({ plan: 3 }), null);
    assert.equal(getMembershipPlanId(['PRO']), null);
});

test('restored membership remains unconfirmed until the server refresh succeeds', () => {
    assert.equal(getPricingMembershipState({
        isLoading: false,
        isAuthenticated: true,
        membership: { plan: 'PRO' },
        membershipStatus: 'restored-unverified',
    }), 'unavailable');
    assert.equal(getPricingMembershipState({
        isLoading: true,
        isAuthenticated: true,
        membership: { plan: 'PRO' },
        membershipStatus: 'refreshing',
    }), 'loading');
});

test('a successful refresh can confirm a plan but a failed refresh cannot reuse the cached plan', () => {
    assert.equal(getPricingMembershipState({
        isLoading: false,
        isAuthenticated: true,
        membership: { plan: 'PRO' },
        membershipStatus: 'confirmed',
    }), 'current');
    assert.equal(getPricingMembershipState({
        isLoading: false,
        isAuthenticated: true,
        membership: { plan: 'PRO' },
        membershipStatus: 'refresh-failed',
    }), 'refresh-failed');
});

test('missing or unrecognized confirmed membership never defaults to FREE', () => {
    assert.equal(getPricingMembershipState({
        isLoading: false,
        isAuthenticated: true,
        membership: null,
        membershipStatus: 'missing',
    }), 'unavailable');
    assert.equal(getPricingMembershipState({
        isLoading: false,
        isAuthenticated: true,
        membership: { plan: 'GOLD' },
        membershipStatus: 'confirmed',
    }), 'unavailable');
});

test('unsupported membership remains unavailable and does not infer an account plan', () => {
    const unsupported = membershipFreshnessReducer(initialMembershipFreshness, { type: 'unsupported' });
    assert.deepEqual(unsupported, { membership: null, status: 'unsupported' });
    assert.equal(getPricingMembershipState({
        isLoading: false,
        isAuthenticated: true,
        membership: unsupported.membership,
        membershipStatus: unsupported.status,
    }), 'unavailable');
});

test('restored membership is unverified and a failed refresh clears it without changing authentication', () => {
    const restored = membershipFreshnessReducer(initialMembershipFreshness, {
        type: 'restore', membership: { plan: 'PRO' },
    });
    assert.deepEqual(restored, { membership: null, status: 'restored-unverified' });
    const refreshing = membershipFreshnessReducer(restored, { type: 'refresh-start' });
    assert.deepEqual(refreshing, { membership: null, status: 'refreshing' });
    const failed = membershipFreshnessReducer(refreshing, { type: 'refresh-failed' });
    assert.deepEqual(failed, { membership: null, status: 'refresh-failed' });
    assert.equal(getPricingMembershipState({
        isLoading: false, isAuthenticated: true, membership: failed.membership, membershipStatus: failed.status,
    }), 'refresh-failed');
});

test('server refresh can confirm a membership and missing server data does not assign a default plan', () => {
    const confirmed = membershipFreshnessReducer(initialMembershipFreshness, {
        type: 'server-confirmed', membership: { plan: 'PRO' },
    });
    assert.deepEqual(confirmed, { membership: { plan: 'PRO' }, status: 'confirmed' });
    assert.equal(getPricingMembershipState({
        isLoading: false, isAuthenticated: true, membership: confirmed.membership, membershipStatus: confirmed.status,
    }), 'current');

    const missing = membershipFreshnessReducer(confirmed, { type: 'server-confirmed', membership: null });
    assert.deepEqual(missing, { membership: null, status: 'missing' });
    assert.equal(getPricingMembershipState({
        isLoading: false, isAuthenticated: true, membership: missing.membership, membershipStatus: missing.status,
    }), 'unavailable');
});

test('only the latest membership refresh for the active session may apply success or failure', () => {
    const oldRequest = { requestId: 1, sessionId: 4, token: 'token-old' };
    assert.equal(isCurrentMembershipRefresh?.(oldRequest, {
        requestId: 1, sessionId: 4, token: 'token-old',
    }), true);
    assert.equal(isCurrentMembershipRefresh?.(oldRequest, {
        requestId: 2, sessionId: 4, token: 'token-old',
    }), false); // a newer refresh already resolved or started
    assert.equal(isCurrentMembershipRefresh?.(oldRequest, {
        requestId: 1, sessionId: 5, token: 'token-old',
    }), false); // logout/login created a new session even if a token is reused
    assert.equal(isCurrentMembershipRefresh?.(oldRequest, {
        requestId: 1, sessionId: 4, token: 'token-new',
    }), false);
});
