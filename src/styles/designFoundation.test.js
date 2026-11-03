import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootCss = await readFile(new URL('./storefront.css', import.meta.url), 'utf8');
const globalCss = await readFile(new URL('../index.css', import.meta.url), 'utf8');
const navigationCss = await readFile(new URL('../styles/storefront.css', import.meta.url), 'utf8');
const customerFocusCss = await Promise.all([
    readFile(new URL('../pages/homepage.css', import.meta.url), 'utf8'),
    readFile(new URL('../pages/marketplace.css', import.meta.url), 'utf8'),
    readFile(new URL('../components/storefront/product-card.css', import.meta.url), 'utf8'),
    readFile(new URL('../pages/product-detail.css', import.meta.url), 'utf8'),
]);
const pageSpinner = await readFile(new URL('../components/ui/PageSpinner.jsx', import.meta.url), 'utf8');
const protectedRoute = await readFile(new URL('../components/ProtectedRoute.jsx', import.meta.url), 'utf8');

function tokenColor(name) {
    const match = rootCss.match(new RegExp(`--${name}:\s*(#[0-9a-f]{6})`, 'i'));
    assert.ok(match, `Expected --${name} color token`);
    return match[1];
}

function luminance(hex) {
    const channels = hex.slice(1).match(/.{2}/g).map(value => parseInt(value, 16) / 255);
    const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first, second) {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
}

test('focus indicator tokens contrast with light and dark Pocket Joy surfaces', () => {
    const paper = tokenColor('joy-paper');
    const plum = tokenColor('joy-ink');
    const lightFocus = tokenColor('joy-focus-light');
    const darkFocus = tokenColor('joy-focus-dark');

    assert.ok(contrast(lightFocus, paper) >= 3, 'light-surface focus indicator must reach 3:1 contrast');
    assert.ok(contrast(darkFocus, plum) >= 3, 'dark-surface focus indicator must reach 3:1 contrast');
});

test('global, field, navigation, and footer focus rings use semantic focus tokens', () => {
    assert.match(globalCss, /:focus-visible\s*\{[^}]*var\(--joy-focus-light\)/s);
    assert.match(globalCss, /\.joy-field:focus-visible\s*\{[^}]*var\(--joy-focus-light\)/s);
    assert.match(navigationCss, /:focus-visible\s*\{[^}]*var\(--joy-focus-light\)/s);
    assert.match(navigationCss, /\.site-footer[^{}]*:focus-visible\s*\{[^}]*var\(--joy-focus-dark\)/s);
    for (const stylesheet of customerFocusCss) {
        assert.match(stylesheet, /:focus-visible[^}]*outline:\s*var\(--joy-focus-width\) solid var\(--joy-focus-light\)/s);
        assert.doesNotMatch(stylesheet, /:focus-visible[^}]*outline:\s*[^;]*#(?:a38cd5|c8b5ed)/i);
    }
});

test('page and protected-route loading spinners use a configured border width', () => {
    assert.match(pageSpinner, /border-4/);
    assert.match(protectedRoute, /border-4/);
    assert.doesNotMatch(`${pageSpinner}\n${protectedRoute}`, /border-3/);
});
