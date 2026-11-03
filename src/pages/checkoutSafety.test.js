import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const checkoutSource = await readFile(new URL('./CheckoutPage.jsx', import.meta.url), 'utf8');
const cartSource = await readFile(new URL('./CartPage.jsx', import.meta.url), 'utf8');
const configSource = await readFile(new URL('../app/config.js', import.meta.url), 'utf8');
const routesSource = await readFile(new URL('../routes/AppRoutes.jsx', import.meta.url), 'utf8');

test('checkout presents an unavailable status without order or payment controls', () => {
    assert.match(checkoutSource, /Chưa hỗ trợ đặt hàng trực tuyến/);
    assert.doesNotMatch(checkoutSource, /<form|<button|clearCart|setTimeout|Đặt hàng thành công|COD|VietQR|MoMo|ZaloPay/i);
    assert.doesNotMatch(configSource, /VITE_MOCK_CHECKOUT|mockCheckout/);
});

test('checkout and cart routes remain registered', () => {
    assert.match(routesSource, /path: 'checkout'/);
    assert.doesNotMatch(routesSource, /ProtectedRoute/);
    assert.match(routesSource, /path: 'cart'/);
    assert.match(routesSource, /path: 'marketplace'/);
    assert.match(routesSource, /path: 'product\/:id'/);
});

test('cart states the unconfirmed shipping policy and does not calculate shipping charges', () => {
    assert.match(cartSource, /Phí vận chuyển sẽ được xác nhận khi đặt hàng/);
    assert.doesNotMatch(cartSource, /30000|300000|Miễn phí vận chuyển/);
});
