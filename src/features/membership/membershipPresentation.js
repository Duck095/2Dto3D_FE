const VALID_MEMBERSHIP_PLAN_IDS = new Set(['FREE', 'PRO', 'PREMIUM']);

export function getMembershipPlanId(membership) {
    if (!membership || typeof membership !== 'object' || Array.isArray(membership)) return null;

    const plan = typeof membership.plan === 'string' ? membership.plan.trim().toUpperCase() : '';
    return VALID_MEMBERSHIP_PLAN_IDS.has(plan) ? plan : null;
}

export function membershipFreshnessReducer(state, action) {
    switch (action.type) {
        case 'restore':
            return {
                membership: null,
                status: action.membership ? 'restored-unverified' : 'missing',
            };
        case 'refresh-start':
            return { membership: null, status: 'refreshing' };
        case 'server-confirmed':
            return action.membership
                ? { membership: action.membership, status: 'confirmed' }
                : { membership: null, status: 'missing' };
        case 'refresh-failed':
            return { membership: null, status: 'refresh-failed' };
        case 'unsupported':
            return { membership: null, status: 'unsupported' };
        case 'logout':
            return { membership: null, status: 'unauthenticated' };
        default:
            return state;
    }
}

export const initialMembershipFreshness = { membership: null, status: 'missing' };

export function isCurrentMembershipRefresh(request, current) {
    return Boolean(
        request
        && current
        && request.requestId === current.requestId
        && request.sessionId === current.sessionId
        && typeof request.token === 'string'
        && request.token.length > 0
        && request.token === current.token,
    );
}

export function getPricingMembershipState({ isLoading, isAuthenticated, membership, membershipStatus }) {
    if (isLoading || membershipStatus === 'refreshing') return 'loading';
    if (!isAuthenticated) return 'unauthenticated';
    if (membershipStatus === 'unsupported') return 'unavailable';
    if (membershipStatus === 'refresh-failed') return 'refresh-failed';
    return membershipStatus === 'confirmed' && getMembershipPlanId(membership) ? 'current' : 'unavailable';
}
