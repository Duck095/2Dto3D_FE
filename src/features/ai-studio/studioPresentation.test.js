import assert from 'node:assert/strict';
import test from 'node:test';
import {
    editChatSidebarReducer,
    getStudioApiInputMode,
    getValidStyleForProduct,
    getStudioWorkflowSteps,
    getStylesForProduct,
    initialEditChatSidebarState,
    initialStudioProductSelectionState,
    isStudioGenerateActionDisabled,
    studioProductSelectionReducer,
} from './studioPresentation.js';

test('the four product groups expose all twenty stable style IDs and display labels', () => {
    const groups = [
        ['keychain', 'ordinary', ['Cute Mascot', 'Chibi', 'Cartoon', 'Minimalist', 'Low Poly']],
        ['keychain', 'click', ['Mini Chibi', 'Mini Mascot', 'Minimalist Click', 'Pixel/Voxel']],
        ['night-light', 'ordinary', ['Minimalist Glow', 'Kawaii Night Light', 'Fantasy Glow', 'Geometric Glow', 'Architectural Miniature']],
        ['figure', 'ordinary', ['Chibi Collectible', 'Anime Figure', 'Cartoon Sculpture', 'Semi-Realistic', 'Fantasy Sculpture', 'Low Poly Sculpture']],
    ];
    const allStyles = groups.flatMap(([product, variant, labels]) => {
        const styles = getStylesForProduct(product, variant);
        assert.deepEqual(styles.map(style => style.label), labels);
        assert.ok(styles.every(style => typeof style.id === 'string' && style.id.length > 0));
        assert.equal(new Set(styles.map(style => style.id)).size, styles.length);
        return styles;
    });
    assert.equal(allStyles.length, 20);
    assert.deepEqual(getStylesForProduct(null), []);
});

test('keychain variant change updates styles and replaces an invalid selected style', () => {
    assert.equal(getValidStyleForProduct('keychain', 'ordinary', 'cute-mascot'), 'cute-mascot');
    assert.equal(getValidStyleForProduct('keychain', 'click', 'cute-mascot'), 'mini-chibi');
    assert.equal(getValidStyleForProduct('keychain', 'click', 'mini-mascot'), 'mini-mascot');
});

test('product changes replace a style that is not available in the new product group', () => {
    assert.equal(getValidStyleForProduct('night-light', 'ordinary', 'low-poly'), 'minimalist-glow');
    assert.equal(getValidStyleForProduct('figure', 'ordinary', 'architectural-miniature'), 'chibi-collectible');
});

test('multi-view never enables generation while existing jobs can still be tracked', () => {
    assert.equal(isStudioGenerateActionDisabled({ inputMode: 'multi', inputReady: true }), true);
    assert.equal(isStudioGenerateActionDisabled({ inputMode: 'multi', inputReady: true, requestIndeterminate: true }), true);
    assert.equal(isStudioGenerateActionDisabled({ inputMode: 'multi', activeJobId: 'job-1' }), false);
    assert.equal(isStudioGenerateActionDisabled({ inputMode: 'text', inputReady: true }), false);
    assert.equal(isStudioGenerateActionDisabled({ inputMode: 'image', inputReady: false }), true);
});

test('product selection changes the selected product without carrying a previous style selection', () => {
    const keychain = studioProductSelectionReducer(initialStudioProductSelectionState, {
        type: 'toggle-product', productType: 'keychain',
    });
    assert.deepEqual(keychain, { productType: 'keychain' });
    const nightLight = studioProductSelectionReducer(keychain, {
        type: 'toggle-product', productType: 'night-light',
    });
    assert.deepEqual(nightLight, { productType: 'night-light' });
    assert.deepEqual(studioProductSelectionReducer(nightLight, {
        type: 'toggle-product', productType: 'night-light',
    }), { productType: null });
});

test('studio workflow has six stages and never completes from model generation alone', () => {
    const initial = getStudioWorkflowSteps();
    assert.deepEqual(initial.map(step => step.label), [
        'Yêu cầu', 'Ảnh tham chiếu 4 góc', 'Duyệt ảnh', 'Model 3D', 'Duyệt model', 'Hoàn tất',
    ]);
    assert.deepEqual(initial.map(step => step.status), Array(6).fill('not-started'));

    const legacyGeneration = getStudioWorkflowSteps({ isGenerated: true });
    assert.equal(legacyGeneration[3].status, 'not-started');
    assert.equal(legacyGeneration[5].status, 'not-started');
});

test('workflow steps follow confirmed Backend project, reference, model, and approval states', () => {
    const project = { phase: 'loaded', projectId: 'project-1', project: { projectId: 'project-1' } };
    const pipeline = (projectStatus, referenceVersions = [], modelVersions = [], jobs = []) => ({
        phase: 'ready',
        pipeline: { projectId: 'project-1', projectStatus, referenceVersions, modelVersions, jobs },
    });
    const reference = (status, versionId = 'reference-1') => ({
        versionId, versionNumber: 1, status, availableViews: ['front', 'left', 'right', 'back'],
        parentVersionId: null, createdAt: '2026-11-18T10:00:00Z',
    });
    const model = (status, extra = {}) => ({
        modelVersionId: 'model-1', versionNumber: 1, referenceVersionId: 'reference-1',
        status, supersedesModelVersionId: null, artifactAvailable: true,
        createdAt: '2026-11-18T10:00:00Z', ...extra,
    });

    const draft = getStudioWorkflowSteps({ projectState: project, pipelineState: pipeline('DRAFT') });
    assert.equal(draft[0].status, 'confirmed');
    assert.equal(draft[1].status, 'not-started');

    const referenceReview = getStudioWorkflowSteps({
        projectState: project, pipelineState: pipeline('REFERENCES_REVIEW', [reference('READY_FOR_REVIEW')]),
    });
    assert.equal(referenceReview[1].status, 'confirmed');
    assert.equal(referenceReview[2].status, 'waiting-user');

    const modelReview = getStudioWorkflowSteps({
        projectState: project,
        pipelineState: pipeline('MODEL_REVIEW', [reference('APPROVED')], [model('READY_FOR_REVIEW')]),
    });
    assert.equal(modelReview[3].status, 'confirmed');
    assert.equal(modelReview[4].status, 'waiting-user');
    assert.equal(modelReview[5].status, 'not-started');

    const completed = getStudioWorkflowSteps({
        projectState: project,
        pipelineState: pipeline('COMPLETED', [reference('APPROVED')], [model('APPROVED')]),
    });
    assert.equal(completed[5].status, 'confirmed');

    const failed = getStudioWorkflowSteps({
        projectState: project, pipelineState: pipeline('FAILED', [], [], [{
            jobId: 'job-1', stage: 'REFERENCE_IMAGE', status: 'FAILED', attemptCount: 1,
            createdAt: '2026-11-18T10:00:00Z', updatedAt: '2026-11-18T10:00:00Z', safeErrorCode: null,
        }]),
    });
    assert.equal(failed[1].status, 'failed');

    const unknown = getStudioWorkflowSteps({ projectState: project, pipelineState: pipeline('BACKEND_NEW_STATE') });
    assert.ok(unknown.every(step => step.status === 'unavailable' || step.status === 'confirmed'));
    assert.equal(unknown[5].status, 'unavailable');
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
