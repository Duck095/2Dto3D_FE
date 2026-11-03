import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const service = await readFile(new URL('./membershipService.js', import.meta.url), 'utf8');

test('membership service exposes an explicit disabled capability and guards all requests', () => {
    assert.match(service, /export const MEMBERSHIP_API_SUPPORTED = false/);
    assert.match(service, /function requireMembershipApi\(\)[\s\S]*?if \(!MEMBERSHIP_API_SUPPORTED\) throw new MembershipUnavailableError\(\)/);
    for (const request of ['getMembershipPlans', 'getMyMembership', 'consumeCommunityDownload']) {
        const body = service.match(new RegExp(`export function ${request}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`))?.[1] || '';
        assert.match(body, /requireMembershipApi\(\)/, `${request} must not reach the unsupported route`);
    }
});
