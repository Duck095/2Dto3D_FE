import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const navbarSource = readFileSync(new URL('./Navbar.jsx', import.meta.url), 'utf8');
const richMegaMenuSource = readFileSync(new URL('./RichMegaMenu.jsx', import.meta.url), 'utf8');

test('mobile login closes navigation overlays through the reducer', () => {
    assert.match(navbarSource, /<Link\s+to="\/login"\s+onClick=\{\(\)\s*=>\s*dispatchOverlay\(\{\s*type:\s*'close-all'\s*\}\)\}>Đăng nhập<\/Link>/);
});

test('mobile registration closes navigation overlays through the reducer', () => {
    assert.match(navbarSource, /<Link\s+to="\/register"\s+onClick=\{\(\)\s*=>\s*dispatchOverlay\(\{\s*type:\s*'close-all'\s*\}\)\}>Tạo tài khoản<\/Link>/);
});

test('Navbar no longer references setters removed by reducer migration', () => {
    assert.doesNotMatch(navbarSource, /\bset(?:MobileOpen|OpenGroup|SearchOpen|AccountOpen)\b/);
});

test('mobile accordion controls point to the rendered card panel ID', () => {
    assert.match(navbarSource, /aria-controls=\{openGroup === group\.id \? `site-mobile-group-\$\{group\.id\}` : undefined\}/);
    assert.match(navbarSource, /openGroup === group\.id && <MobileNavigationCards\s+id=\{`site-mobile-group-\$\{group\.id\}`\}/);
    assert.match(richMegaMenuSource, /export function MobileNavigationCards\(\{ id, group, location, onNavigate \}\)/);
    assert.match(richMegaMenuSource, /<div id=\{id\} className="site-mobile-menu__items rich-mobile-cards">/);
});

test('collapsed mobile accordion panels are not rendered as hidden focusable content', () => {
    assert.match(navbarSource, /openGroup === group\.id && <MobileNavigationCards/);
    assert.doesNotMatch(navbarSource, /<MobileNavigationCards[^>]*hidden/);
});
