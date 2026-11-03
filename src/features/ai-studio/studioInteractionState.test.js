import assert from 'node:assert/strict';
import test from 'node:test';
import {
    editChatSidebarReducer,
    historyDrawerReducer,
    getViewerModelScale,
    initialEditChatSidebarState,
    initialHistoryDrawerState,
    initialViewerCustomizationState,
    viewerCustomizationReducer,
    viewerCustomizationToPrintDraftOptions,
} from './studioPresentation.js';
import { createPrintDraftFromGeneration } from './generationPresentation.js';

test('history hover is temporary and clicking an already-hovered trigger pins the drawer', () => {
    const hovered = historyDrawerReducer(initialHistoryDrawerState, { type: 'hover-enter' });
    assert.deepEqual(hovered, { isOpen: true, isPinned: false });

    const clicked = historyDrawerReducer(hovered, { type: 'trigger-click' });
    assert.deepEqual(clicked, { isOpen: true, isPinned: true });
    assert.deepEqual(historyDrawerReducer(clicked, { type: 'hover-leave' }), clicked);

    const closedByClick = historyDrawerReducer(clicked, { type: 'trigger-click' });
    assert.deepEqual(closedByClick, initialHistoryDrawerState);
    assert.deepEqual(historyDrawerReducer(hovered, { type: 'hover-leave' }), initialHistoryDrawerState);
});

test('history pin can be removed while open and Escape closes the drawer', () => {
    const opened = historyDrawerReducer(initialHistoryDrawerState, { type: 'trigger-click' });
    const unpinned = historyDrawerReducer(opened, { type: 'pin-toggle' });
    assert.deepEqual(unpinned, { isOpen: true, isPinned: false });
    assert.deepEqual(historyDrawerReducer(unpinned, { type: 'escape' }), initialHistoryDrawerState);
});

test('closing edit chat restores the sidebar state captured when chat opened', () => {
    const initiallyOpen = editChatSidebarReducer(initialEditChatSidebarState, { type: 'open-chat' });
    assert.equal(initiallyOpen.isChatOpen, true);
    assert.equal(initiallyOpen.isPanelCollapsed, true);
    assert.deepEqual(editChatSidebarReducer(initiallyOpen, { type: 'close-chat' }), initialEditChatSidebarState);

    const collapsed = editChatSidebarReducer(initialEditChatSidebarState, { type: 'toggle-panel' });
    const chatFromCollapsed = editChatSidebarReducer(collapsed, { type: 'open-chat' });
    assert.equal(chatFromCollapsed.isPanelCollapsed, true);
    assert.deepEqual(editChatSidebarReducer(chatFromCollapsed, { type: 'close-chat' }), collapsed);
});

test('viewer customization updates are preserved in the Print Quote draft snapshot', () => {
    const reset = viewerCustomizationReducer(initialViewerCustomizationState, {
        type: 'reset-for-model',
        parts: [{ id: 'body', color: '#aaaaaa' }, { id: 'tag' }],
    });
    const customized = viewerCustomizationReducer(reset, {
        type: 'viewer-change',
        customization: {
            modelColor: '#c8649a',
            partColors: { body: '#c8649a', tag: '#5d4b9a' },
            selectedPartId: 'tag',
            modelScale: { x: 125, y: 125, z: 125 },
        },
    });
    const options = viewerCustomizationToPrintDraftOptions(customized);
    const draft = createPrintDraftFromGeneration({
        id: 9,
        status: 'completed',
        title: 'Real generation',
        modelUrl: '/owned/model.glb',
        format: 'GLB',
        dimensions: '10 x 20 x 30 mm',
        parts: [{ id: 'body' }, { id: 'tag' }],
    }, { productName: 'Real generation', ...options });

    assert.deepEqual(draft?.partColors, { body: '#c8649a', tag: '#5d4b9a' });
    assert.equal(draft?.modelColor, '#c8649a');
    assert.deepEqual(draft?.modelScale, { x: 125, y: 125, z: 125 });
});

test('viewer dimension edits become independent per-axis scale percentages without changing the source dimensions', () => {
    const base = { x: 10, y: 20, z: 30 };
    const current = { x: 15, y: 10, z: 60 };
    assert.deepEqual(getViewerModelScale(base, current), { x: 150, y: 50, z: 200 });
    assert.deepEqual(base, { x: 10, y: 20, z: 30 });
    assert.deepEqual(getViewerModelScale(base, base), { x: 100, y: 100, z: 100 });
});

test('resetting viewer customization for a new model does not carry colors or scale from the prior model', () => {
    const changed = viewerCustomizationReducer(initialViewerCustomizationState, {
        type: 'viewer-change',
        customization: { modelColor: '#c8649a', partColors: { old: '#c8649a' }, modelScale: { x: 150, y: 100, z: 100 } },
    });
    const next = viewerCustomizationReducer(changed, { type: 'reset-for-model', parts: [{ id: 'new' }] });
    assert.equal(next.modelColor, null);
    assert.deepEqual(next.partColors, { new: '#e2e8f0' });
    assert.deepEqual(next.modelScale, { x: 100, y: 100, z: 100 });
});
