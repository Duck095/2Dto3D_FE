import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspace = await readFile(new URL('./AIStudioWorkspace.jsx', import.meta.url), 'utf8');
const page = await readFile(new URL('./AIStudioPage.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('./ai-studio.css', import.meta.url), 'utf8');

test('studio keeps the three approved input tabs and hides unrelated input controls', () => {
    for (const label of ['Text to 3D', 'Image to 3D', 'Nhiều góc nhìn']) assert.ok(workspace.includes(label));
    assert.match(workspace, /inputMode === 'text'[\s\S]*?textarea/);
    assert.match(workspace, /inputMode === 'image'[\s\S]*?Tải lên một ảnh/);
    assert.match(workspace, /inputMode === 'multi'[\s\S]*?viewSlots/);
    assert.match(workspace, /role="tablist"/);
});

test('product design options are conditional and UI presents no stepper or extra style selector', () => {
    assert.match(workspace, /\{productType && \([\s\S]*?ai-studio__choice-group/);
    assert.match(workspace, /getDesignTypes\(productType\)/);
    assert.match(workspace, /type: 'toggle-design', designType: type/);
    assert.doesNotMatch(workspace, /Realistic|Fantasy|Khủng long|Phong cách thể hiện/);
    assert.doesNotMatch(workspace, /stepper|activeStep|Quality|Ultra/);
});

test('reference-image action cannot report success or invoke model generation implicitly', () => {
    assert.match(workspace, /Tạo ảnh tham chiếu/);
    assert.match(workspace, /onClick=\{showReferenceUnavailable\}/);
    assert.match(workspace, /Tạo ảnh tham chiếu chưa khả dụng[\s\S]*?Chưa có ảnh mới nào được tạo/);
    assert.match(workspace, /Tạo mô hình 3D trực tiếp từ mô tả[\s\S]*?onClick=\{onGenerate\}/);
    assert.match(workspace, /inputMode === 'image' && uploadedImg[\s\S]*?onClick=\{onGenerate\}/);
});

test('multiple-view uploads are preview-only and are not mapped to the single-image API', () => {
    assert.match(workspace, /handleMultiViewFile\(slot\.id/);
    assert.match(workspace, /Ảnh thu nhỏ các góc nhìn/);
    assert.match(workspace, /Chế độ gửi nhiều ảnh chưa được API hiện tại hỗ trợ/);
    assert.match(page, /getStudioApiInputMode\(inputMode\)/);
    assert.match(page, /if \(!apiInputMode\)[\s\S]*?chưa hỗ trợ gửi nhiều góc nhìn/);
    assert.match(page, /inputMode: apiInputMode/);
});

test('empty preview and model preview require genuine image/model data', () => {
    assert.match(workspace, /Hôm nay bạn muốn tạo gì bằng 3D\?/);
    assert.match(workspace, /Chọn sản phẩm, kiểu thiết kế và cách nhập ý tưởng để bắt đầu\./);
    assert.doesNotMatch(workspace, /Tạo ảnh tham chiếu rồi duyệt trước khi tạo model 3D/);
    assert.match(workspace, /\{isGenerated \? modelViewer : previewImage \?/);
    assert.match(page, /resolveGenerationResponse\(result\)/);
    assert.match(page, /resolution\.state !== 'completed'/);
    assert.match(page, /type: 'completed', ownerKey: requestOwnerKey, generation: generated/);
    assert.match(page, /createPrintDraftFromGeneration\(selectedGeneration/);
    assert.match(page, /if \(!printDraft\)[\s\S]*?return;/);
    assert.match(workspace, /onPrintAction/);
});

test('edit chat is closed by default and reports unavailable editing without fake results', () => {
    assert.match(workspace, /editChatSidebarReducer/);
    assert.match(workspace, /type: 'open-chat'/);
    assert.match(workspace, /Chỉnh trực tiếp 3D/);
    assert.match(workspace, /Chỉnh ảnh 2D rồi tạo lại 3D/);
    assert.match(workspace, /Tính năng chỉnh sửa chưa khả dụng[\s\S]*?chưa được gửi và mô hình chưa thay đổi/);
    assert.doesNotMatch(workspace, /provider|Meshy|Rodin/i);
});

test('history drawer starts closed, supports hover, pin, touch, and Escape, and uses real session results only', () => {
    assert.match(workspace, /historyDrawerReducer/);
    assert.match(workspace, /type: 'hover-enter'/);
    assert.match(workspace, /type: 'hover-leave'/);
    assert.match(workspace, /onClick=\{handleHistoryClick\}/);
    assert.match(workspace, /event\.key === 'Escape'/);
    assert.match(workspace, /event\.key === 'Escape'[\s\S]*?dispatchHistoryDrawer\(\{ type: 'escape' \}\)/);
    assert.match(workspace, /if \(!isHistoryOpen\) return undefined/);
    assert.match(workspace, /historyItems\.length === 0/);
    assert.match(page, /type: 'completed', ownerKey: requestOwnerKey, generation: generated/);
    assert.match(page, /type: 'reset-owner', ownerKey: generationSessionKey/);
    assert.match(page, /historyItems=\{sessionHistory\}/);
});

test('approved product taxonomy and three-choice limit remain testable', () => {
    assert.match(workspace, /Móc khóa/);
    assert.match(workspace, /Đèn ngủ/);
    assert.match(workspace, /Figure/);
    assert.match(workspace, /onClick=\{\(\) => dispatchProductSelection\(\{ type: 'toggle-design', designType: type \}\)\}/);
    assert.match(workspace, /tối đa 3/);
});

test('studio keeps the approved visual identity and does not add a main landmark or fixed history column', () => {
    assert.match(workspace, /studio-input-panel/);
    assert.doesNotMatch(workspace, /ai-studio__topbar/);
    assert.doesNotMatch(workspace, /Pocket Joy/);
    assert.doesNotMatch(workspace, /<main\b/);
    assert.match(styles, /Be\+Vietnam\+Pro/);
    assert.match(styles, /@media \(max-width: 760px\)/);
    assert.match(styles, /@media \(max-width: 960px\)/);
    assert.match(styles, /grid-template-columns: minmax\(0, var\(--studio-sidebar-width\)\) 16px minmax\(0, 1fr\)/);
    assert.match(styles, /ai-studio__history-drawer \{ position: absolute/);
});

test('generation owner safety, viewer permissions, and Print Quote data contract stay intact', () => {
    assert.match(page, /getGenerationOwnerKey\(user\)/);
    assert.match(page, /restorePendingGenerationState\(window\.sessionStorage, persistedGenerationOwnerKey\)/);
    assert.match(page, /persistPendingGenerationState\(window\.sessionStorage, requestStorageOwnerKey, previousRequestMayStillRun\)/);
    assert.match(page, /generationOwnerKeyRef\.current !== requestOwnerKey/);
    assert.match(page, /allowDownload=\{false\}/);
    assert.match(page, /onCustomizationChange=\{handleViewerCustomizationChange\}/);
    assert.match(page, /navigate\('\/print-quote',[\s\S]*?printDraft/);
});

test('AI Studio gates all displayed generation results synchronously by the current owner', () => {
    assert.match(page, /getGenerationResultsForOwner\(generationResults, generationSessionKey\)/);
    assert.match(page, /generationMessageOwnerKey === generationSessionKey/);
    assert.match(page, /generationResultsReducer/);
    assert.match(page, /type: 'reset-owner', ownerKey: generationSessionKey/);
    assert.match(page, /type: 'completed', ownerKey: requestOwnerKey, generation: generated/);
    assert.match(page, /type: 'select-history', ownerKey: generationSessionKey/);
});

test('Viewer customization changes flow into parent state and the validated Print Quote draft', () => {
    assert.match(page, /onCustomizationChange=\{handleViewerCustomizationChange\}/);
    assert.match(page, /dispatchViewerCustomization\(\{ type: 'viewer-change', customization \}\)/);
    assert.match(page, /viewerCustomizationToPrintDraftOptions\(viewerCustomization\)/);
    assert.match(page, /createPrintDraftFromGeneration\(selectedGeneration,[\s\S]*?viewerCustomizationToPrintDraftOptions/);
    assert.match(page, /modelColor="#e2e8f0"/);
});

test('chat/sidebar state uses transitions that restore the pre-chat collapse choice', () => {
    assert.match(workspace, /editChatSidebarReducer/);
    assert.match(workspace, /type: 'open-chat'/);
    assert.match(workspace, /type: 'close-chat'/);
});

test('studio workspace starts with the controls and viewer without a redundant internal header', () => {
    assert.doesNotMatch(workspace, /ai-studio__topbar/);
    assert.doesNotMatch(workspace, /Từ ý tưởng đến mô hình 3D của riêng bạn/);
    assert.match(workspace, /ai-studio__sidebar/);
    assert.match(workspace, /ai-studio__preview-panel/);
    assert.match(workspace, /Làm mới lựa chọn/);
});

test('sidebar has desktop collapse and accessible mobile drawer controls with Escape support', () => {
    assert.match(workspace, /mobile-open/);
    assert.match(workspace, /mobile-close/);
    assert.match(workspace, /aria-controls="studio-input-panel"/);
    assert.match(workspace, /ai-studio__sidebar-rail/);
    assert.match(workspace, /mobileDrawerCloseRef/);
    assert.match(workspace, /event\.key === 'Escape'/);
});

test('studio responsive layout uses fluid panel and viewer sizing without fixed preview heights', () => {
    const stageRules = [...styles.matchAll(/\.ai-studio__preview-stage\s*\{([^}]*)\}/g)];
    const fluidStageRule = stageRules.find(([, declarations]) => /height:\s*clamp\(/.test(declarations)
        && /min-height:\s*0/.test(declarations))?.[1] || '';
    assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*var\(--studio-sidebar-width\)\)\s+16px\s+minmax\(0,\s*1fr\)/);
    assert.match(styles, /--studio-sidebar-width:\s*clamp\(/);
    assert.match(styles, /height:\s*clamp\([^;]*100dvh/);
    assert.match(styles, /@media\s*\(max-width:\s*960px\)/);
    assert.match(styles, /position:\s*fixed/);
    assert.match(styles, /prefers-reduced-motion:\s*reduce/);
    assert.notEqual(fluidStageRule, '');
});

test('desktop divider supports pointer and keyboard resizing, while compact and collapsed layouts omit it', () => {
    assert.match(workspace, /!isCompactLayout && !panelCollapsed && workspaceMetrics\.width > 0/);
    assert.match(workspace, /role="separator"/);
    assert.match(workspace, /aria-orientation="vertical"/);
    assert.match(workspace, /onPointerDown=\{startSidebarResize\}/);
    assert.match(workspace, /onPointerMove=\{moveSidebarResize\}/);
    assert.match(workspace, /onPointerUp=\{finishSidebarResize\}/);
    assert.match(workspace, /onKeyDown=\{handleSidebarResizeKeyDown\}/);
    assert.match(workspace, /aria-valuemin=/);
    assert.match(workspace, /aria-valuemax=/);
    assert.match(workspace, /setPointerCapture/);
    assert.match(styles, /cursor:\s*col-resize/);
    assert.match(styles, /ai-studio__resize-handle\s*\{\s*display:\s*none/);
});

test('sidebar width is measured from its workspace and stored locally with validation', () => {
    assert.match(workspace, /new ResizeObserver\(measureWorkspace\)/);
    assert.match(workspace, /getBoundingClientRect\(\)\.width/);
    assert.match(workspace, /readStudioSidebarWidth\(window\.localStorage\)/);
    assert.match(workspace, /writeStudioSidebarWidth\(window\.localStorage/);
    assert.match(workspace, /effectiveSidebarWidth\s*=\s*workspaceMetrics\.width\s*>\s*0\s*\?\s*clampStudioSidebarWidth\(sidebarWidth, workspaceMetrics\.width, workspaceMetrics\.dividerWidth\)/);
    assert.match(workspace, /style=\{\{ '--studio-sidebar-width': `\$\{effectiveSidebarWidth\}px` \}\}/);
    const measurement = workspace.match(/const measureWorkspace = \(\) => \{([\s\S]*?)\n        \};/)?.[1] || '';
    assert.doesNotMatch(measurement, /setSidebarWidth|sidebarWidthRef\.current\s*=/);
});

test('large desktop workspace expands to 3600px while keeping responsive gutters', () => {
    assert.match(styles, /width:\s*min\(calc\(100%\s*-\s*clamp\(24px,\s*4vw,\s*64px\)\),\s*3600px\)/);
    assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*var\(--studio-sidebar-width\)\)\s+16px\s+minmax\(0,\s*1fr\)/);
    assert.match(styles, /@media\s*\(max-width:\s*960px\)[\s\S]*?ai-studio__resize-handle\s*\{\s*display:\s*none/);
});

test('sidebar resizing remains horizontal and does not alter viewer height', () => {
    assert.match(workspace, /start\.width\s*\+\s*event\.clientX\s*-\s*start\.x/);
    assert.doesNotMatch(workspace, /event\.clientY|start\.y/);
    assert.match(styles, /\.ai-studio__preview-stage\s*\{[\s\S]*?height:\s*clamp\([^;]*100dvh/);
});
