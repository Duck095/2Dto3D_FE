import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('./PricingPage.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('./pricing.css', import.meta.url), 'utf8');

test('pricing page uses 2Dto3D and Pocket Joy without the Morphia identity', () => {
    assert.match(page, /2Dto3D/);
    assert.match(page, /Pocket Joy/);
    assert.doesNotMatch(page, /Morphia/i);
});

test('unverified plan prices and benefits are not hardcoded or presented', () => {
    for (const claim of ['150.000', '250.000', 'credits', 'Ưu tiên xử lý', 'Giảm 15%', 'Giảm 20%', 'Không giới hạn']) {
        assert.doesNotMatch(page, new RegExp(claim, 'i'));
    }
    assert.match(page, /Thông tin gói đang được cập nhật/);
});

test('membership plans API is not consumed without a backend contract and no purchase action is rendered', () => {
    assert.doesNotMatch(page, /getMembershipPlans\(/);
    assert.doesNotMatch(page, /Thanh toán|Mua gói|Đăng ký miễn phí/i);
});

test('auth loading, empty membership, and valid account plan states are handled without inferring Free', () => {
    assert.match(page, /useAuth\(\)/);
    assert.match(page, /getPricingMembershipState/);
    assert.match(page, /Gói trên tài khoản/);
    assert.match(page, /Chưa có thông tin membership hợp lệ/);
    assert.doesNotMatch(page, /membership\?\.plan\s*\|\|\s*'FREE'/);
});

test('unsupported membership is clearly reported without calling an unsupported retry endpoint', () => {
    assert.match(page, /refreshMembership/);
    assert.match(page, /Backend hiện chưa hỗ trợ membership/);
    assert.match(page, /membershipState === 'refresh-failed' && MEMBERSHIP_API_SUPPORTED/);
    assert.match(page, /membershipState === 'refresh-failed' && MEMBERSHIP_API_SUPPORTED[\s\S]*?onClick=\{refreshMembership\}/);
});

test('pricing layout uses Pocket Joy tokens and explicit responsive breakpoints', () => {
    assert.match(styles, /background:\s*var\(--joy-paper\)/);
    assert.match(styles, /var\(--joy-ink\)/);
    assert.match(styles, /max-width:\s*767px/);
    assert.match(styles, /min-width:\s*768px/);
    assert.match(styles, /min-width:\s*1280px/);
    assert.doesNotMatch(page, /overflow-x-auto|min-w-\[700px\]/);
});
