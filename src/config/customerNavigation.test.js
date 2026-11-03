import assert from 'node:assert/strict';
import test from 'node:test';
import { CUSTOMER_NAV_GROUPS, getNavigationState, getNavigationPresentation, isNavigationItemActive, isNavigationItemAvailable, transitionNavigationOverlay, isNavigationGroupActive } from './customerNavigation.js';

test('customer navigation exposes the six approved groups in order', () => {
    assert.deepEqual(CUSTOMER_NAV_GROUPS.map(group => group.label), [
        'Cửa hàng', 'Sáng tạo AI', 'Kho mẫu', 'Hướng dẫn', 'Dịch vụ in 3D', 'Về chúng tôi',
    ]);
});

test('store links use the approved collection taxonomy', () => {
    const store = CUSTOMER_NAV_GROUPS.find(group => group.id === 'store');
    assert.deepEqual(store.items.filter(item => item.collection).map(item => item.collection), [
        'clicky-fidget', 'cute-sweet', 'characters-collectibles', 'personalized-gifts',
    ]);
    assert.equal(store.items[0].to, '/marketplace');
});

test('studio links select supported image or text modes without changing the route', () => {
    const studio = CUSTOMER_NAV_GROUPS.find(group => group.id === 'ai');
    assert.ok(studio.items.some(item => item.to === '/studio?mode=image'));
    assert.ok(studio.items.some(item => item.to === '/studio?mode=text'));
    assert.ok(studio.items.every(item => item.to.startsWith('/studio')));
});

test('unready content has no active destination and print quote requires a draft', () => {
    const items = CUSTOMER_NAV_GROUPS.flatMap(group => group.items);
    assert.ok(items.filter(item => item.disabled).every(item => !item.to));
    assert.ok(items.some(item => item.requiresPrintDraft && item.to === '/print-quote'));
    assert.ok(items.every(item => !item.to?.startsWith('/resources')));
});

test('navigation preserves existing editor drafts only for their matching routes', () => {
    const modelEditDraft = { modelEditDraft: { prompt: 'keep this draft' } };
    const printDraft = { printDraft: { modelId: 7 } };
    assert.equal(getNavigationState('/studio?mode=image', modelEditDraft), modelEditDraft);
    assert.equal(getNavigationState('/print-quote', printDraft), printDraft);
    assert.equal(getNavigationState('/marketplace', modelEditDraft), undefined);
});

test('route groups have one active navigation group at a time', () => {
    for (const pathname of ['/marketplace', '/product/42', '/studio', '/products', '/workflow', '/print-quote', '/about', '/cart']) {
        const active = CUSTOMER_NAV_GROUPS.filter(group => isNavigationGroupActive(group.id, pathname));
        assert.ok(active.length <= 1, `${pathname} activates ${active.map(group => group.id).join(', ')}`);
    }
    assert.equal(CUSTOMER_NAV_GROUPS.find(group => group.id === 'store' && isNavigationGroupActive(group.id, '/product/42'))?.id, 'store');
    assert.equal(CUSTOMER_NAV_GROUPS.find(group => group.id === 'about' && isNavigationGroupActive(group.id, '/about'))?.id, 'about');
});

test('desktop and compact layouts render only their own navigation menu', () => {
    assert.deepEqual(getNavigationPresentation({ compact: false, mobileOpen: true, openGroup: 'store' }), {
        showDesktopMegaMenu: true, showMobileMenu: false, visibleGroup: 'store',
    });
    assert.deepEqual(getNavigationPresentation({ compact: true, mobileOpen: true, openGroup: 'store' }), {
        showDesktopMegaMenu: false, showMobileMenu: true, visibleGroup: 'store',
    });
    assert.deepEqual(getNavigationPresentation({ compact: true, mobileOpen: false, openGroup: 'store' }), {
        showDesktopMegaMenu: false, showMobileMenu: false, visibleGroup: null,
    });
});

test('opening one overlay closes conflicting overlays and closing mobile clears its accordion', () => {
    const initial = { mobileOpen: false, openGroup: 'store', searchOpen: true, accountOpen: true };
    assert.deepEqual(transitionNavigationOverlay(initial, { type: 'open-group', groupId: 'ai' }), {
        mobileOpen: false, openGroup: 'ai', searchOpen: false, accountOpen: false,
    });
    assert.deepEqual(transitionNavigationOverlay({ ...initial, mobileOpen: true, openGroup: 'store' }, { type: 'toggle-mobile' }), {
        mobileOpen: false, openGroup: null, searchOpen: false, accountOpen: false,
    });
    assert.deepEqual(transitionNavigationOverlay(initial, { type: 'open-search' }), {
        mobileOpen: false, openGroup: null, searchOpen: true, accountOpen: false,
    });
    assert.deepEqual(transitionNavigationOverlay(initial, { type: 'open-account' }), {
        mobileOpen: false, openGroup: null, searchOpen: false, accountOpen: true,
    });
});

test('studio links, collection search and about anchors have exact active states', () => {
    const studio = CUSTOMER_NAV_GROUPS.find(group => group.id === 'ai');
    const [image, text, defaultStudio] = studio.items;
    assert.equal(isNavigationItemActive(image, { pathname: '/studio', search: '?mode=image', hash: '' }), true);
    assert.equal(isNavigationItemActive(image, { pathname: '/studio', search: '?mode=text', hash: '' }), false);
    assert.equal(isNavigationItemActive(text, { pathname: '/studio', search: '', hash: '' }), false);
    assert.equal(isNavigationItemActive(defaultStudio, { pathname: '/studio', search: '?mode=image', hash: '' }), false);
    assert.equal(isNavigationItemActive(defaultStudio, { pathname: '/studio', search: '', hash: '' }), true);

    const clicky = CUSTOMER_NAV_GROUPS.find(group => group.id === 'store').items[1];
    assert.equal(isNavigationItemActive(clicky, { pathname: '/marketplace', search: '?collection=clicky-fidget&search=key', hash: '' }), true);
    assert.equal(isNavigationItemActive(clicky, { pathname: '/marketplace', search: '?search=clicky', hash: '' }), false);
    const about = CUSTOMER_NAV_GROUPS.find(group => group.id === 'about').items[1];
    assert.equal(isNavigationItemActive(about, { pathname: '/about', search: '', hash: '#pocket-joy' }), true);
    assert.equal(isNavigationItemActive(about, { pathname: '/about', search: '', hash: '#quy-trinh' }), false);
});

test('every approved navigation group has a rich menu, valid CTA and safe action references', () => {
    assert.equal(CUSTOMER_NAV_GROUPS.length, 6);
    assert.equal(new Set(CUSTOMER_NAV_GROUPS.map(group => group.richMenu?.title)).size, 6);
    for (const group of CUSTOMER_NAV_GROUPS) {
        const menu = group.richMenu;
        assert.ok(menu, `${group.id} has rich menu content`);
        assert.ok(menu.title && menu.description && menu.icon);
        assert.ok(group.items[menu.ctaIndex]?.to, `${group.id} CTA points to an existing route`);
        assert.ok(Array.isArray(menu.actions) && menu.actions.length > 0);
        assert.ok(menu.actions.every(action => group.items[action.itemIndex] && action.icon && action.description));
        assert.ok(menu.discovery?.title && menu.discovery?.description && menu.discovery?.kind);
    }
    const store = CUSTOMER_NAV_GROUPS.find(group => group.id === 'store');
    assert.deepEqual(store.richMenu.actions.map(action => store.items[action.itemIndex].to), [
        '/marketplace', '/marketplace?collection=clicky-fidget', '/marketplace?collection=personalized-gifts',
    ]);
});

test('rich menu content uses honest empty states and avoids unimplemented image-generation claims', () => {
    const catalogMenu = CUSTOMER_NAV_GROUPS.find(group => group.id === 'models').richMenu.discovery;
    assert.match(catalogMenu.title, /Chưa có mô hình công khai được duyệt/);
    assert.doesNotMatch(JSON.stringify(CUSTOMER_NAV_GROUPS), /tạo ảnh 2D|generate 2D/i);
    const quote = CUSTOMER_NAV_GROUPS.find(group => group.id === 'printing').items.find(item => item.requiresPrintDraft);
    assert.ok(quote && quote.disabledReason);
    assert.equal(isNavigationItemAvailable(quote, { state: null }), false);
    assert.equal(isNavigationItemAvailable(quote, { state: { printDraft: { modelId: 'draft-1' } } }), true);
});
