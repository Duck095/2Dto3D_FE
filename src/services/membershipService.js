import axiosClient from '../config/axiosClient';
import { API_ROUTES } from '../config/apiRoutes';

// Enable only after the Backend publishes and supports these routes.
export const MEMBERSHIP_API_SUPPORTED = false;

export class MembershipUnavailableError extends Error {
    constructor() {
        super('Membership is not available from the Backend.');
        this.name = 'MembershipUnavailableError';
    }
}

function requireMembershipApi() {
    if (!MEMBERSHIP_API_SUPPORTED) throw new MembershipUnavailableError();
}

export function getMembershipPlans() {
    requireMembershipApi();
    return axiosClient.get(API_ROUTES.memberships.plans);
}

export function getMyMembership() {
    requireMembershipApi();
    return axiosClient.get(API_ROUTES.memberships.me);
}

export function consumeCommunityDownload(modelId) {
    requireMembershipApi();
    return axiosClient.post(API_ROUTES.memberships.communityDownload(modelId));
}
