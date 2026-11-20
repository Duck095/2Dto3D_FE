import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspace = await readFile(new URL('./AIStudioWorkspace.jsx', import.meta.url), 'utf8');
const page = await readFile(new URL('./AIStudioPage.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('./ai-studio.css', import.meta.url), 'utf8');
const presentation = await readFile(new URL('../features/ai-studio/studioPresentation.js', import.meta.url), 'utf8');
const generationPresentation = await readFile(new URL('../features/ai-studio/generationPresentation.js', import.meta.url), 'utf8');

test('text project save and restore use the authenticated Design Project API without changing generation payloads', () => {
    assert.match(page, /createAIStudioProject/);
    assert.match(page, /getAIStudioProject/);
    assert.match(page, /buildTextDesignProjectRequest\(/);
    assert.match(page, /createAIStudioProject\(request\.data, requestFiles, keyRecord\.key, \{ signal: controller\.signal \}\)/);
    assert.match(page, /getAIStudioProject\(projectIdFromUrl, \{ signal: controller\.signal \}\)/);
    assert.match(page, /setProductType\(project\.productType\)/);
    assert.match(page, /setStyle\(project\.styleId\)/);
    assert.match(page, /setTextPrompt\(project\.originalIdea \|\| ''\)/);
    assert.match(page, /projectIdFromUrl/);
    assert.match(page, /projectOwnerKeyRef\.current !== requestSessionKey/);
    assert.match(page, /getDesignProjectStateForOwner\(projectState, generationSessionKey\)/);
    assert.match(page, /createDesignProjectIdempotencyRecord\(request\.data, savedRequest, createIdempotencyKey, requestContentFingerprint\)/);
    assert.match(page, /createMultiDesignProjectIdempotencyRecord\(request\.data, savedRequest, createIdempotencyKey, requestImageHashes\)/);
    assert.match(page, /projectIdempotencyKeysRef\.current/);
    assert.match(page, /claimDesignProjectSave\(projectInFlightOwnersRef\.current, generationOwnerKey\)/);
    assert.match(page, /releaseDesignProjectSave\(projectInFlightOwnersRef\.current, requestOwnerKey\)/);
    assert.match(page, /projectCreateRequestRef\.current\?\.abort\(\)/);
    assert.match(page, /classifyDesignProjectRequestError\(error\)/);
    assert.match(page, /setProjectState\(\{[\s\S]*?phase: hasUnresolvedSave \? 'indeterminate' : 'idle'/);
    assert.match(workspace, /Lưu dự án/);
    assert.match(workspace, /Project ID/);
    assert.match(workspace, /Sản phẩm/);
    assert.match(workspace, /Phong cách/);
    assert.match(workspace, /ai-studio__history-project-status/);
    assert.match(workspace, /Ý tưởng đã lưu/);
    assert.match(page, /productType=\{productType\}/);
    assert.match(page, /keychainVariant=\{keychainVariant\}/);
    assert.match(page, /onSaveProject=\{handleSaveProject\}/);
    assert.match(page, /const data = \{ prompt: textPrompt, style, inputMode: apiInputMode \}/);
});

test('IMAGE project restore downloads and validates its original source before marking it available', () => {
    assert.match(page, /const \[uploadedFile, setUploadedFileState\] = useState\(null\)/);
    assert.match(page, /getImageContentSha256\(file\)/);
    assert.match(page, /createAIStudioProject\(request\.data, requestFiles, keyRecord\.key/);
    assert.match(page, /imageContentSha256/);
    assert.match(page, /localProjectImageSha256Ref/);
    assert.match(page, /clearUploadedFile\(\)/);
    assert.match(workspace, /originalIdea/);
    assert.match(workspace, /maxLength=\{4000\}/);
    assert.match(page, /getAIStudioProjectInputContent/);
    assert.match(page, /restoreProjectInputFile\(project\.projectId, input, controller\.signal\)/);
    assert.match(page, /sha256 !== input\.sha256/);
    assert.match(page, /buildImageDesignProjectRequest\(/);
});

test('IMAGE replacement and removal clear prior File identity, digest and preview URL', () => {
    assert.match(page, /function setUploadedFile\(file\) \{\s*clearUploadedFile\(\);\s*const validationError = validateStudioImage\(file\)/);
    assert.match(page, /function clearUploadedFile\(\) \{[\s\S]*?releaseUploadedObjectUrl\(\);[\s\S]*?setUploadedFileState\(null\);[\s\S]*?setImageContentSha256\(null\)/);
    assert.match(page, /previousProjectOwnerKeyRef\.current !== persistedGenerationOwnerKey/);
});

test('MULTI Project restore rebuilds ordered source views from confirmed Backend input metadata', () => {
    assert.match(page, /buildMultiDesignProjectRequest\(/);
    assert.match(page, /const \[multiViews, setMultiViews\] = useState\(\{\}\)/);
    assert.match(page, /const requestFiles = inputMode === 'multi' \? request\.files/);
    assert.match(page, /createAIStudioProject\(request\.data, requestFiles, keyRecord\.key/);
    assert.match(page, /getImageContentSha256\(file\)/);
    assert.match(page, /multiViews=\{multiViews\}/);
    assert.match(page, /onMultiViewFile=\{handleMultiViewFile\}/);
    assert.match(page, /onClearMultiViews=\{clearMultiViews\}/);
    assert.match(page, /if \(accountChanged\) \{[\s\S]*?clearMultiViews\(\)/);
    assert.match(workspace, /Góc ảnh đã lưu/);
    assert.match(page, /setMultiViews\(restoredViews\)/);
    assert.match(page, /localProjectMultiFingerprintRef\.current = JSON\.stringify\(project\.inputs\.map/);
    assert.doesNotMatch(workspace, /const \[multiViews, setMultiViews\]/);
});

test('studio puts all three input modes before their input fields and product choices', () => {
    for (const label of ['Text to 3D', 'Image to 3D', 'Nhiều góc ảnh']) assert.ok(workspace.includes(label));
    assert.match(workspace, /inputMode === 'text'[\s\S]*?textarea/);
    assert.match(workspace, /inputMode === 'image'[\s\S]*?Upload one image/);
    assert.match(workspace, /inputMode === 'multi'[\s\S]*?viewSlots/);
    assert.match(workspace, /role="tablist"/);
    assert.match(workspace, /aria-label="Generation input mode"/);
    const modePosition = workspace.indexOf('aria-label="Generation input mode"');
    const descriptionPosition = workspace.indexOf('id="studio-description-heading"');
    const productPosition = workspace.indexOf('legend>Chọn sản phẩm');
    const stylePosition = workspace.indexOf('id="studio-settings-heading"');
    assert.ok(modePosition < descriptionPosition && descriptionPosition < productPosition);
    assert.ok(productPosition < stylePosition);
});

test('studio only sets inert when the input panel should be inactive', () => {
    assert.match(workspace, /inert=\{\(isCompactLayout \? !isMobileDrawerOpen : panelCollapsed\) \? '' : undefined\}/);
});

test('product options and backend status remain while AI quality controls are removed', () => {
    assert.match(workspace, /productType === 'keychain' && <fieldset className="ai-studio__choice-group"/);
    assert.match(workspace, /getStylesForProduct\(productType, keychainVariant\)/);
    assert.match(workspace, /Generation Settings/);
    assert.doesNotMatch(workspace, /QUALITY|Standard|Draft|quality=\{|setQuality|QUALITY_OPTIONS/);
    assert.doesNotMatch(workspace, /STYLE_OPTIONS|type: 'toggle-design'/);
    assert.doesNotMatch(workspace, /Ultra/);
    assert.match(workspace, /className="ai-studio__stepper"/);
    assert.match(presentation, /Ảnh tham chiếu 4 góc/);
    assert.match(presentation, /Backend đã ghi nhận ảnh tham chiếu/);
    assert.match(workspace, /Loại móc khóa/);
    assert.match(workspace, /Thường/);
    assert.match(workspace, /Click/);
    assert.doesNotMatch(styles, /ai-studio__quality-(group|options)/);
    assert.match(workspace, /value=\{style\}/);
    assert.doesNotMatch(page, /\[quality, setQuality\]|quality=\{quality\}/);
    assert.doesNotMatch(page, /LEGACY_GENERATION_API_QUALITY|quality:\s*['"]High['"]/);
    assert.match(page, /style=\{style\}/);
});

test('Design Project actions call authenticated Backend workflow commands with idempotency keys', () => {
    for (const action of ['onGenerateReferences', 'onApproveReferences', 'onGenerateModel', 'onApproveModel']) {
        assert.match(workspace, new RegExp(action));
        assert.match(page, new RegExp(action));
    }
    assert.match(page, /generateAIStudioProjectReferences\(/);
    assert.match(page, /approveAIStudioProjectReference\(/);
    assert.match(page, /generateAIStudioProjectModel\(/);
    assert.match(page, /approveAIStudioProjectModel\(/);
    assert.match(page, /Idempotency-Key/);
    assert.match(page, /getAIStudioProjectPipeline/);
    assert.match(page, /getAIStudioProjectTimeline/);
    assert.match(workspace, /referenceViewState\?\.phase === 'ready'/);
    assert.match(workspace, /modelArtifactState\?\.phase === 'ready'/);
    assert.doesNotMatch(workspace, /showReferenceUnavailable/);
    assert.doesNotMatch(page, /GENERATION_UNAVAILABLE_MESSAGE/);
});

test('multiple-view uploads are Page-owned and saved only through the MULTI Project API', () => {
    assert.match(workspace, /onMultiViewFile\?\.\(slot\.id, event\.target\.files\?\.\[0\]\)/);
    assert.match(workspace, /Ảnh thu nhỏ các góc nhìn/);
    assert.match(workspace, /Tải lên từ 2 đến 8 ảnh PNG, JPEG hoặc WebP/);
    assert.doesNotMatch(workspace, /Multi-view images can be previewed/);
    assert.match(page, /getStudioApiInputMode\(inputMode\)/);
    assert.match(page, /buildMultiDesignProjectRequest\(/);
    assert.match(page, /if \(!activeJobId && !apiInputMode\)[\s\S]*?nhiều góc nhìn chưa được hỗ trợ/);
    assert.match(page, /inputMode: apiInputMode/);
});

test('image mode puts upload before a three-row auto-growing optional description', () => {
    const imageStart = workspace.indexOf("{inputMode === 'image' &&");
    const multiStart = workspace.indexOf("{inputMode === 'multi' &&", imageStart);
    const imageSection = workspace.slice(imageStart, multiStart);
    assert.ok(imageSection.indexOf('ai-studio__upload-zone') < imageSection.indexOf('Mô tả bổ sung (không bắt buộc)'));
    assert.match(imageSection, /rows=\{3\}/);
    assert.match(imageSection, /imageDescriptionTextareaRef/);
    assert.match(imageSection, /textPrompt\.length}\/4000/);
    assert.match(styles, /ai-studio__description-card textarea\[data-autosize/);
    assert.match(styles, /max-height:\s*200px/);
    assert.match(styles, /overflow-y:\s*auto/);
});

test('AI generation metadata no longer exposes the legacy AI quality value', () => {
    assert.doesNotMatch(generationPresentation, /\['Quality',\s*'quality'\]/);
});

test('empty preview and model preview require genuine image/model data', () => {
    assert.match(workspace, /Hôm nay bạn muốn tạo gì bằng 3D\?/);
    assert.match(workspace, /Chọn sản phẩm, kiểu thiết kế và cách nhập ý tưởng để bắt đầu\./);
    assert.doesNotMatch(workspace, /Tạo ảnh tham chiếu rồi duyệt trước khi tạo model 3D/);
    assert.match(workspace, /isShowingDesignProjectModel \? designProjectModelViewer : isGenerated \? modelViewer : previewImage/);
    assert.match(page, /resolveGenerationResponse\(result\)/);
    assert.match(page, /resolution\.state !== 'completed'/);
    assert.match(page, /type: 'completed', ownerKey: requestOwnerKey, generation: generated/);
    assert.match(page, /createPrintDraftFromGeneration\(selectedGeneration/);
    assert.match(page, /if \(!printDraft\)[\s\S]*?return;/);
    assert.match(workspace, /onPrintAction/);
});

test('Design Project print preparation requires owner-scoped Backend readiness and matching artifact digest', () => {
    assert.match(page, /getAIStudioProjectModelPrintReadiness\(projectId, model\.modelVersionId, \{ signal: controller\.signal \}\)/);
    assert.match(page, /normalizeAIStudioPrintReadiness\(response, projectId, model\.modelVersionId\)/);
    assert.match(page, /selectedModelVersionIdRef\.current === model\.modelVersionId/);
    assert.match(page, /normalized\.artifactSha256 !== modelArtifactState\.sha256/);
    assert.match(page, /readiness\?\.readiness !== 'READY'/);
    assert.match(page, /readiness\.dimensionsMm/);
    assert.match(page, /dimensionSource: readiness\.dimensionSource/);
    assert.match(page, /measurementArtifactSha256: readiness\.measurementArtifactSha256/);
    assert.match(workspace, /designProjectPrintReadinessState\?\.phase === 'ready'/);
    assert.match(workspace, /data\?\.artifactSha256 === modelArtifactState\.sha256/);
    assert.match(workspace, /onRetryPrintReadiness/);
    assert.doesNotMatch(page, /dimensions:.*getObjectByProperty|Box3|boundingBox/);
});

test('edit chat is closed by default and reports unavailable editing without fake results', () => {
    assert.match(workspace, /editChatSidebarReducer/);
    assert.match(workspace, /type: 'open-chat'/);
    assert.match(workspace, /Chỉnh trực tiếp 3D/);
    assert.match(workspace, /Chỉnh ảnh 2D rồi tạo lại 3D/);
    assert.match(workspace, /setChatNotice\('Tính năng chỉnh sửa chưa khả dụng\./);
    assert.match(workspace, /<strong>Chỉnh sửa chưa khả dụng\.<\/strong>/);
    assert.match(workspace, /API chỉnh sửa chưa được tích hợp/);
    assert.doesNotMatch(workspace, /provider|Meshy|Rodin/i);
});

test('generation history occupies the account panel and displays real session results only', () => {
    assert.match(workspace, /className="ai-studio__history-panel"/);
    assert.match(workspace, /Generation History/);
    assert.match(workspace, /historyItems\.length === 0/);
    assert.match(workspace, /onClick=\{\(\) => onSelectGeneration\(item\)\}/);
    assert.match(page, /type: 'completed', ownerKey: requestOwnerKey, generation: generated/);
    assert.match(page, /type: 'reset-owner', ownerKey: generationSessionKey/);
    assert.match(page, /historyItems=\{sessionHistory\}/);
    assert.match(page, /requestConfirmed=\{Boolean\(activeJobId \|\| selectedGeneration\)\}/);
});

test('Design Project History loads authenticated pages, retries, deduplicates, and opens the canonical Studio route', async () => {
    const historyPresentation = await readFile(new URL('../features/ai-studio/projectHistoryPresentation.js', import.meta.url), 'utf8');
    assert.match(page, /getAIStudioProjectHistory\(0, PROJECT_HISTORY_PAGE_SIZE, \{ signal: controller\.signal \}\)/);
    assert.match(page, /normalizeDesignProjectHistoryPage\(response, 0, PROJECT_HISTORY_PAGE_SIZE\)/);
    assert.match(page, /projectHistoryPageInFlightRef\.current === nextPage/);
    assert.match(page, /mergeDesignProjectHistoryPages\(state\.items, page\.content\)/);
    assert.match(page, /projectHistoryOwnerKeyRef\.current !== requestOwnerKey/);
    assert.match(page, /projectHistoryInitialRequestRef\.current\?\.abort\(\)/);
    assert.match(page, /projectHistoryPageRequestRef\.current\?\.abort\(\)/);
    assert.match(page, /setProjectHistoryReloadRevision\(\(revision\) => revision \+ 1\)/);
    assert.match(page, /search\.set\('projectId', project\.projectId\)/);
    assert.match(page, /projectHistoryState=\{visibleProjectHistoryState\}/);
    assert.match(workspace, /projectHistoryState\.phase === 'ready' && projectHistoryState\.items\.length === 0/);
    assert.match(workspace, /'Tải thêm dự án'/);
    assert.match(workspace, /onRetryProjectHistory/);
    assert.match(workspace, /aria-current=\{isCurrentProject \? 'page' : undefined\}/);
    assert.match(workspace, /Legacy Generation History/);
    assert.match(historyPresentation, /export function normalizeDesignProjectHistoryPage/);
    assert.match(historyPresentation, /export function mergeDesignProjectHistoryPages/);
});

test('project save stays in the input flow and an opened backend project is shown in Generation History', () => {
    assert.doesNotMatch(workspace, /<h3 id="studio-project-heading"[^>]*>[^<]*Design Project/);
    assert.match(workspace, /ai-studio__submit-block[\s\S]*?onClick=\{onSaveProject\}/);
    assert.match(workspace, /projectHistoryState\.items\?\.some\(\(project\) => project\.projectId === currentProjectId\)[\s\S]*?<ProjectDetailsPanel/);
    assert.match(workspace, /isLoadedCurrentProject && <ProjectDetailsPanel/);
    assert.match(workspace, /getPipelineStatusLabel\(currentPipeline\?\.projectStatus \|\| project\.status, 'project'\)/);
    assert.match(workspace, /<PipelinePanel[\s\S]*?state=\{pipelineState\}[\s\S]*?timelineState=\{timelineState\}/);
});

test('generation keeps its existing payload while project save sends product and style identifiers', () => {
    assert.match(page, /const data = \{ prompt: textPrompt, style, inputMode: apiInputMode \}/);
    assert.match(workspace, /Lưu dự án gửi Product Type\{productType === 'keychain' \? ' cùng Keychain Variant' : ''\} và Style ID/);
    assert.doesNotMatch(page, /LEGACY_GENERATION_API_QUALITY|quality:\s*['"]High['"]/);
});

test('workflow stepper follows Backend approval and completion states', () => {
    assert.match(workspace, /getStudioWorkflowSteps\(/);
    assert.match(presentation, /Duyệt ảnh/);
    assert.match(presentation, /Duyệt model/);
    assert.match(presentation, /Backend xác nhận model đã duyệt và dự án đã hoàn tất/);
    assert.match(presentation, /projectStatus === 'COMPLETED' && modelStatus === 'APPROVED'/);
    assert.match(presentation, /status: 'unavailable'/);
    assert.doesNotMatch(workspace, /<strong>Hoàn tất<\/strong>[\s\S]{0,140}\{isGenerated \?/);
});

test('approved product taxonomy keeps keychain variant separate from product styles', () => {
    assert.match(workspace, /Móc khóa/);
    assert.match(workspace, /Đèn ngủ/);
    assert.match(workspace, /Tượng 3D/);
    assert.match(workspace, /\[\['ordinary', 'Thường'\], \['click', 'Click'\]\]/);
    assert.match(workspace, /getStylesForProduct\(productType, keychainVariant\)/);
    assert.doesNotMatch(workspace, /type: 'toggle-design'|STYLE_OPTIONS|PBR/);
});

test('MULTI copy separates Project save from legacy model generation and AI output', () => {
    assert.match(workspace, /Lưu dự án gửi từ 2 đến 8 ảnh MULTI lên Design Project API/);
    assert.match(workspace, /Generate Model chưa hỗ trợ đầu vào MULTI trên legacy Generation API/);
    assert.match(workspace, /Lưu dự án không tạo ảnh tham chiếu AI hoặc GLB/);
    assert.doesNotMatch(workspace, /Chế độ nhiều góc chỉ lưu ảnh xem trước/);
    assert.doesNotMatch(workspace, /API hiện tại chỉ nhận một ảnh hoặc mô tả/);
    assert.match(workspace, /disabled=\{generateActionDisabled\}/);
    assert.match(workspace, /isStudioGenerateActionDisabled\(/);
    assert.match(workspace, /Tạo model chưa khả dụng/);
});

test('Project source-image restore validates content and never claims data that was not loaded', () => {
    assert.match(page, /hasMatchingProjectInputBlob\(content, input\)/);
    assert.match(page, /sha256 !== input\.sha256/);
    assert.match(workspace, /Backend chưa trả về nội dung ảnh nguồn có thể khôi phục/);
    assert.match(workspace, /Backend chưa trả về đủ nội dung ảnh nguồn để khôi phục dự án MULTI/);
    assert.match(workspace, /project\.inputMode === 'image' && !projectState\.sourceImageAvailable/);
    assert.match(workspace, /project\.inputMode === 'multi' && !projectState\.sourceMultiFilesAvailable/);
    assert.doesNotMatch(workspace, /Backend chưa có API đọc ảnh nguồn/);
});

test('MULTI save validates every SHA before claiming the owner in-flight guard', () => {
    const shaValidation = page.indexOf("if (inputMode === 'multi' && requestImageHashes.some(({ sha256 }) => !/^[a-f0-9]{64}$/");
    const guardClaim = page.indexOf('claimDesignProjectSave(projectInFlightOwnersRef.current, generationOwnerKey)', shaValidation);
    assert.ok(shaValidation >= 0 && guardClaim > shaValidation);
    assert.match(page, /savedState\.classification === 'unknown'/);
  assert.match(page, /keyRecord = inputMode === 'multi'[\s\S]*?await createMultiDesignProjectIdempotencyRecord/);
    assert.match(page, /projectInputRevisionRef\.current !== requestRevision/);
});

test('Reset uses Page-owned setters and releases Page-owned MULTI resources', () => {
    assert.match(workspace, /function resetStudioSelections\(\) \{[\s\S]*?onClearMultiViews\?\.\(\)[\s\S]*?setProductType\(null\)/);
    assert.doesNotMatch(workspace, /dispatchProductSelection/);
    assert.match(page, /onClearMultiViews=\{clearMultiViews\}/);
    assert.match(page, /function clearMultiViews\(\) \{[\s\S]*?URL\.revokeObjectURL/);
});

test('studio keeps Pocket Joy identity and uses a responsive history column without another navbar', () => {
    assert.match(workspace, /studio-input-panel/);
    assert.doesNotMatch(workspace, /ai-studio__topbar/);
    assert.match(workspace, /Pocket Joy/);
    assert.doesNotMatch(workspace, /<main\b/);
    assert.match(styles, /Be\+Vietnam\+Pro/);
    assert.match(styles, /@media \(max-width: 760px\)/);
    assert.match(styles, /@media \(max-width: 960px\)/);
    assert.match(styles, /grid-template-columns: minmax\(0, var\(--studio-sidebar-width\)\) var\(--studio-divider-width\) minmax\(0, 1fr\) minmax\(var\(--studio-history-min-width\), 290px\)/);
    assert.match(styles, /\.ai-studio__history-panel/);
    assert.match(styles, /@media \(max-width: 600px\)/);
    assert.doesNotMatch(workspace, /<nav\b|<Navbar/);
});

test('generation owner safety, viewer permissions, and Print Quote data contract stay intact', () => {
    assert.match(page, /getGenerationOwnerKey\(user\)/);
    assert.match(page, /2dto3d\.ai-studio\.idempotency:/);
    assert.match(page, /window\.sessionStorage\.setItem\(storageKey, idempotencyKey\)/);
    assert.match(page, /createAIGeneration\(data, imageFile, idempotencyKey, \{ signal: controller\.signal \}\)/);
    assert.match(page, /generationRequestRef\.current\?\.abort\(\)/);
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

test('collapsed desktop sidebar keeps the preview and history columns aligned without a blank rail card', () => {
    assert.match(styles, /@media \(min-width: 961px\)[\s\S]*?ai-studio-page--panel-collapsed \.ai-studio__workspace\s*\{\s*grid-template-columns:\s*48px minmax\(0, 1fr\) minmax\(250px, 290px\)/);
    assert.match(styles, /ai-studio__sidebar\.is-collapsed \.ai-studio__sidebar-rail\s*\{[^}]*background:\s*transparent;[^}]*box-shadow:\s*none/s);
});

test('studio responsive layout uses fluid panel and viewer sizing without fixed preview heights', () => {
    const stageRules = [...styles.matchAll(/\.ai-studio__preview-stage\s*\{([^}]*)\}/g)];
    const fluidStageRule = stageRules.find(([, declarations]) => /height:\s*clamp\(/.test(declarations)
        && /min-height:\s*0/.test(declarations))?.[1] || '';
    assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*var\(--studio-sidebar-width\)\)\s+var\(--studio-divider-width\)\s+minmax\(0,\s*1fr\)\s+minmax\(var\(--studio-history-min-width\),\s*290px\)/);
    assert.match(styles, /@media \(max-width: 1199px\) and \(min-width: 961px\)[\s\S]*?--studio-history-min-width: 220px; grid-template-columns: minmax\(0, var\(--studio-sidebar-width\)\)/);
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
    assert.match(workspace, /getPropertyValue\('--studio-history-min-width'\)/);
    assert.match(workspace, /getBoundingClientRect\(\)\.width[\s\S]*?historyWidth = measuredHistoryWidth > 0 \? measuredHistoryWidth/);
    assert.match(workspace, /observer\.observe\(historyPanel\)/);
    assert.match(workspace, /workspaceMetrics\.historyWidth/);
    assert.match(workspace, /readStudioSidebarWidth\(window\.localStorage\)/);
    assert.match(workspace, /readStudioSidebarCollapsed\(window\.localStorage\)/);
    assert.match(workspace, /writeStudioSidebarCollapsed\(window\.localStorage, panelCollapsed\)/);
    assert.match(workspace, /writeStudioSidebarWidth\(window\.localStorage/);
    assert.match(workspace, /effectiveSidebarWidth\s*=\s*workspaceMetrics\.width\s*>\s*0\s*\?\s*clampStudioSidebarWidth\(sidebarWidth, workspaceMetrics\.width, workspaceMetrics\.dividerWidth, workspaceMetrics\.historyWidth\)/);
    assert.match(workspace, /style=\{\{ '--studio-sidebar-width': `\$\{effectiveSidebarWidth\}px` \}\}/);
    const measurement = workspace.match(/const measureWorkspace = \(\) => \{([\s\S]*?)\n        \};/)?.[1] || '';
    assert.doesNotMatch(measurement, /setSidebarWidth|sidebarWidthRef\.current\s*=/);
});

test('large desktop workspace expands to 3600px while keeping responsive gutters', () => {
    assert.match(styles, /width:\s*min\(calc\(100%\s*-\s*clamp\(24px,\s*4vw,\s*64px\)\),\s*3600px\)/);
    assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*var\(--studio-sidebar-width\)\)\s+var\(--studio-divider-width\)\s+minmax\(0,\s*1fr\)\s+minmax\(var\(--studio-history-min-width\),\s*290px\)/);
    assert.match(styles, /@media\s*\(max-width:\s*960px\)[\s\S]*?ai-studio__resize-handle\s*\{\s*display:\s*none/);
});

test('sidebar resizing remains horizontal and does not alter viewer height', () => {
    assert.match(workspace, /start\.width\s*\+\s*event\.clientX\s*-\s*start\.x/);
    assert.doesNotMatch(workspace, /event\.clientY|start\.y/);
    assert.match(styles, /\.ai-studio__preview-stage\s*\{[\s\S]*?height:\s*clamp\([^;]*100dvh/);
});
test('Pipeline reads only a validated loaded Project and bounds polling with cleanup', async () => {
    const pipelinePresentation = await readFile(new URL('../features/ai-studio/pipelinePresentation.js', import.meta.url), 'utf8');
    assert.match(page, /getAIStudioProjectPipeline/);
    assert.match(page, /normalizeProjectPipeline\(response, projectId\)/);
    assert.match(page, /visibleProjectState\.phase === 'loaded'/);
    assert.match(page, /visibleProject\?\.projectId === projectIdFromUrl/);
    assert.match(page, /pipelineGenerationRef\.current/);
    assert.match(page, /pipelineController\.signal/);
    assert.match(page, /clearTimeout\(pollTimer\)/);
    assert.match(page, /PIPELINE_POLL_INTERVAL_MS/);
    assert.match(page, /MAX_AUTOMATIC_PIPELINE_READS/);
    assert.match(page, /document\.visibilityState/);
    assert.match(workspace, /pipelineState/);
    assert.match(workspace, /onReloadPipeline/);
    assert.match(pipelinePresentation, /export function normalizeProjectPipeline/);
    assert.match(page, /generateAIStudioProjectReferences/);
    assert.match(page, /approveAIStudioProjectReference/);
    assert.match(page, /generateAIStudioProjectModel/);
    assert.match(page, /approveAIStudioProjectModel/);
    assert.match(page, /getAIStudioProjectTimeline/);
    assert.match(page, /normalizeProjectTimeline\(response, projectId\)/);
});
