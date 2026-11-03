import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DESIGN_TYPES_BY_PRODUCT,
    editChatSidebarReducer,
    getDesignTypes,
    getStudioApiInputMode,
    initialEditChatSidebarState,
    initialStudioProductSelectionState,
    studioProductSelectionReducer,
    toggleDesignType,
} from './studioPresentation.js';

test('product selection exposes only the Founder-approved design types', () => {
    assert.deepEqual(getDesignTypes('keychain'), ['Chibi', 'Động vật', 'Nhân vật', 'Khớp', 'Click']);
    assert.deepEqual(getDesignTypes('night-light'), ['Kiến trúc', 'Hình hộp tối giản']);
    assert.deepEqual(getDesignTypes('figure'), ['Chibi', 'Anime', 'Động vật', 'Thần thoại', 'Khớp động']);
    assert.equal(Object.keys(DESIGN_TYPES_BY_PRODUCT).length, 3);
    assert.deepEqual(getDesignTypes(null), []);
});

test('design selection toggles and never exceeds three choices', () => {
    let selected = [];
    selected = toggleDesignType(selected, 'Chibi');
    selected = toggleDesignType(selected, 'Anime');
    selected = toggleDesignType(selected, 'Động vật');
    assert.deepEqual(toggleDesignType(selected, 'Thần thoại'), selected);
    assert.deepEqual(toggleDesignType(selected, 'Anime'), ['Chibi', 'Động vật']);
});

test('product selection clears designs when deselected and removes styles invalid for the next product', () => {
    const keychain = studioProductSelectionReducer(initialStudioProductSelectionState, {
        type: 'toggle-product', productType: 'keychain',
    });
    const selected = { ...keychain, designTypes: ['Chibi', 'Click', 'Nhân vật'] };
    const deselected = studioProductSelectionReducer(selected, {
        type: 'toggle-product', productType: 'keychain',
    });
    assert.deepEqual(deselected, { productType: null, designTypes: [] });

    const figure = studioProductSelectionReducer(selected, {
        type: 'toggle-product', productType: 'figure',
    });
    assert.deepEqual(figure, { productType: 'figure', designTypes: ['Chibi'] });
    assert.equal(figure.designTypes.length <= 3, true);
});

test('multiple-view input is not mapped to the existing single-image generation contract', () => {
    assert.equal(getStudioApiInputMode('text'), 'text');
    assert.equal(getStudioApiInputMode('image'), 'image');
    assert.equal(getStudioApiInputMode('multi'), null);
});

test('desktop collapse and mobile drawer are independent and do not clear studio inputs', () => {
    const collapsed = editChatSidebarReducer(initialEditChatSidebarState, { type: 'toggle-panel' });
    assert.equal(collapsed.isPanelCollapsed, true);

    const mobileOpen = editChatSidebarReducer(collapsed, { type: 'mobile-open' });
    assert.equal(mobileOpen.isMobileDrawerOpen, true);
    assert.equal(mobileOpen.isPanelCollapsed, true);

    const mobileClosed = editChatSidebarReducer(mobileOpen, { type: 'mobile-close' });
    assert.equal(mobileClosed.isMobileDrawerOpen, false);
    assert.equal(mobileClosed.isPanelCollapsed, true);
});

test('chat closes the mobile drawer and restores its previous state and desktop collapse state', () => {
    const drawerOpen = editChatSidebarReducer(initialEditChatSidebarState, { type: 'mobile-open' });
    const chatOpen = editChatSidebarReducer(drawerOpen, { type: 'open-chat' });
    assert.equal(chatOpen.isChatOpen, true);
    assert.equal(chatOpen.isMobileDrawerOpen, false);
    assert.equal(chatOpen.isPanelCollapsed, true);

    const chatClosed = editChatSidebarReducer(chatOpen, { type: 'close-chat' });
    assert.equal(chatClosed.isChatOpen, false);
    assert.equal(chatClosed.isMobileDrawerOpen, true);
    assert.equal(chatClosed.isPanelCollapsed, false);
});

test('chat restore preserves a sidebar that was already collapsed before chat opened', () => {
    const collapsed = editChatSidebarReducer(initialEditChatSidebarState, { type: 'toggle-panel' });
    const chatOpen = editChatSidebarReducer(collapsed, { type: 'open-chat' });
    const chatClosed = editChatSidebarReducer(chatOpen, { type: 'close-chat' });
    assert.equal(chatClosed.isPanelCollapsed, true);
});
