import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const layout = await readFile(new URL('./AdminLayout.jsx', import.meta.url), 'utf8');
const routes = await readFile(new URL('../routes/AppRoutes.jsx', import.meta.url), 'utf8');

test('Admin shell exposes a mobile dialog menu with Escape and managed focus', () => {
  assert.match(layout, /aria-expanded=\{mobileDialogOpen\}/);
  assert.match(layout, /aria-controls="admin-navigation"/);
  assert.match(layout, /role=\{mobileDialogOpen \? 'dialog' : undefined\}/);
  assert.match(layout, /aria-modal=\{mobileDialogOpen \? true : undefined\}/);
  assert.match(layout, /event\.key === 'Escape'/);
  assert.match(layout, /if \(!mobileDialogOpen\) return;/);
  assert.match(layout, /focus\(\)/);
  assert.match(layout, /querySelectorAll\(['"]a\[href\],button:not\(:disabled\)['"]\)/);
});

test('mobile dialog isolates background from keyboard and assistive technology', () => {
  assert.match(layout, /useLayoutEffect/);
  assert.ok(layout.includes("element.setAttribute('inert', '')"));
  assert.ok(layout.includes('aria-hidden={mobileDialogOpen}'));
  assert.match(layout, /<div\s+className="admin-navigation-backdrop"\s+aria-hidden="true"\s+onClick=\{closeMobileNavigation\}/);
});

test('leaving the mobile breakpoint closes the drawer and keeps focus visible on desktop', () => {
  assert.ok(layout.includes("matchMedia('(max-width: 767px)')"));
  assert.ok(layout.includes("addEventListener('change', handleViewportChange)"));
  assert.match(layout, /if \(!event\.matches\) \{\r?\n\s*setMobileNavOpen\(false\);/);
  assert.ok(layout.includes("querySelector('.admin-brand')?.focus()"));
});

test('sidebar navigation closes mobile menu only for its single implemented destination', () => {
  assert.ok(layout.includes('to={item.to}'));
  assert.ok(layout.includes('onClick={() => { if (mobileDialogOpen) closeMobileNavigation(); }}'));
  assert.match(layout, /disabled=\{!item\.available\}/);
});

test('sidebar brand content link also closes the mobile menu', () => {
  assert.ok(layout.includes('className="admin-brand"'));
  assert.ok(layout.includes('onClick={() => { if (mobileDialogOpen) closeMobileNavigation(); }}'));
});

test('Admin header uses verified backend identity and existing AuthContext logout', () => {
  assert.match(layout, /currentUserStatus === 'verified'/);
  assert.match(layout, /verifiedIdentity\?\.name/);
  assert.match(layout, /verifiedIdentity\?\.email/);
  assert.match(layout, /const \{ logout, currentUser, currentUserStatus \} = useAuth\(\)/);
  assert.match(layout, /logout\(\)/);
  assert.match(layout, /navigate\('\/login', \{ replace: true \}\)/);
});

test('Admin entry remains guarded and extensible through one nested route tree', () => {
  assert.equal((routes.match(/path: '\/admin'/g) || []).length, 1);
  assert.match(routes, /path: '\/admin',[\s\S]*?requiredContext="ADMIN"[\s\S]*?children:\s*\[[\s\S]*?index:\s*true[\s\S]*?AdminOverviewPage/);
  assert.doesNotMatch(routes, /path: '\/admin\/(?:staff|tasks|[a-z-]+)'/);
});
