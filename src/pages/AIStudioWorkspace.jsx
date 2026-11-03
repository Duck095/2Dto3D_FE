import { forwardRef, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import {
    editChatSidebarReducer,
    historyDrawerReducer,
    initialEditChatSidebarState,
    initialHistoryDrawerState,
    initialStudioProductSelectionState,
    MULTI_VIEW_SLOTS,
    getDesignTypes,
    getStudioApiInputMode,
    studioProductSelectionReducer,
} from '../features/ai-studio/studioPresentation.js';
import { validateStudioImage } from '../features/ai-studio/uploadValidation.js';
import {
    clampStudioSidebarWidth,
    DEFAULT_STUDIO_SIDEBAR_WIDTH,
    getStudioSidebarBounds,
    getStudioSidebarKeyboardWidth,
    readStudioSidebarWidth,
    writeStudioSidebarWidth,
} from '../features/ai-studio/resizableSidebar.js';

const PRODUCTS = [
    { id: 'keychain', label: 'Móc khóa' },
    { id: 'night-light', label: 'Đèn ngủ' },
    { id: 'figure', label: 'Figure' },
];

const INPUT_MODES = [
    { id: 'text', label: 'Text to 3D', icon: 'edit_note' },
    { id: 'image', label: 'Image to 3D', icon: 'image' },
    { id: 'multi', label: 'Nhiều góc nhìn', icon: 'collections' },
];

function Icon({ children, className = '' }) {
    return <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{children}</span>;
}

const StudioButton = forwardRef(function StudioButton({ children, className = '', ...props }, ref) {
    return <button {...props} ref={ref} className={`ai-studio__button ${className}`}>{children}</button>;
});

export default function AIStudioWorkspace({
    inputMode,
    setInputMode,
    textPrompt,
    setTextPrompt,
    uploadedImg,
    onUploadFile,
    clearUploadedFile,
    uploadError,
    isGenerated,
    selectedGeneration,
    modelViewer,
    isGenerating,
    isGenerationPending,
    canSubmit,
    onGenerate,
    onAllowNewRequest,
    genError,
    genStatus,
    historyItems,
    onSelectGeneration,
    onPrintAction,
    onResetPreview,
}) {
    const singleFileRef = useRef(null);
    const multiFileRefs = useRef({});
    const multiUrlsRef = useRef([]);
    const mobileDrawerToggleRef = useRef(null);
    const mobileDrawerCloseRef = useRef(null);
    const inputPanelRef = useRef(null);
    const workspaceRef = useRef(null);
    const sidebarRef = useRef(null);
    const resizeHandleRef = useRef(null);
    const resizeStartRef = useRef(null);
    const sidebarWidthRef = useRef(DEFAULT_STUDIO_SIDEBAR_WIDTH);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        try {
            return readStudioSidebarWidth(window.localStorage);
        } catch {
            return DEFAULT_STUDIO_SIDEBAR_WIDTH;
        }
    });
    const [workspaceMetrics, setWorkspaceMetrics] = useState({ width: 0, dividerWidth: 16 });
    const effectiveSidebarWidth = workspaceMetrics.width > 0
        ? clampStudioSidebarWidth(sidebarWidth, workspaceMetrics.width, workspaceMetrics.dividerWidth)
        : sidebarWidth;
    const [isSidebarResizing, setIsSidebarResizing] = useState(false);
    const [workspacePanelState, dispatchWorkspacePanel] = useReducer(editChatSidebarReducer, initialEditChatSidebarState);
    const {
        isPanelCollapsed: panelCollapsed,
        isMobileDrawerOpen,
        isChatOpen,
    } = workspacePanelState;
    const [isCompactLayout, setIsCompactLayout] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia('(max-width: 960px)').matches
    ));
    const [productSelection, dispatchProductSelection] = useReducer(studioProductSelectionReducer, initialStudioProductSelectionState);
    const { productType, designTypes } = productSelection;
    const [referenceUnavailable, setReferenceUnavailable] = useState(false);
    const [selectedMultiView, setSelectedMultiView] = useState('front');
    const [multiViews, setMultiViews] = useState({});
    const [extraViewSlots, setExtraViewSlots] = useState([]);
    const [multiUploadError, setMultiUploadError] = useState('');
    const [isImageExpanded, setIsImageExpanded] = useState(false);
    const [chatMode, setChatMode] = useState('direct-3d');
    const [chatPrompt, setChatPrompt] = useState('');
    const [chatNotice, setChatNotice] = useState('');
    const [chatAttachment, setChatAttachment] = useState(null);
    const [historyDrawer, dispatchHistoryDrawer] = useReducer(historyDrawerReducer, initialHistoryDrawerState);
    const { isOpen: isHistoryOpen, isPinned: isHistoryPinned } = historyDrawer;
    const [imageZoom, setImageZoom] = useState(1);

    useEffect(() => {
        sidebarWidthRef.current = sidebarWidth;
    }, [sidebarWidth]);

    useLayoutEffect(() => {
        if (!workspaceRef.current) return undefined;

        const measureWorkspace = () => {
            const element = workspaceRef.current;
            if (!element) return;
            const width = element.getBoundingClientRect().width;
            setWorkspaceMetrics(current => current.width === width ? current : { ...current, width });
        };

        measureWorkspace();
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(measureWorkspace);
            observer.observe(workspaceRef.current);
            return () => observer.disconnect();
        }

        window.addEventListener('resize', measureWorkspace);
        return () => window.removeEventListener('resize', measureWorkspace);
    }, [isCompactLayout, panelCollapsed]);

    useEffect(() => {
        const media = window.matchMedia('(max-width: 960px)');
        const handleChange = event => {
            setIsCompactLayout(event.matches);
            dispatchWorkspacePanel({ type: 'mobile-close' });
        };
        setIsCompactLayout(media.matches);
        media.addEventListener('change', handleChange);
        return () => media.removeEventListener('change', handleChange);
    }, []);

    const availableDesignTypes = getDesignTypes(productType);
    const validApiMode = getStudioApiInputMode(inputMode);
    const hasSelection = Boolean(productType && designTypes.length);
    const viewSlots = [...MULTI_VIEW_SLOTS, ...extraViewSlots];
    const currentMultiImage = multiViews[selectedMultiView];
    const previewImage = inputMode === 'multi' ? currentMultiImage?.url : uploadedImg;

    useEffect(() => () => {
        multiUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        multiUrlsRef.current = [];
    }, []);

    useEffect(() => {
        if (!isHistoryOpen) return undefined;
        function closeHistory(event) {
            if (event.key === 'Escape') {
                dispatchHistoryDrawer({ type: 'escape' });
            }
        }
        window.addEventListener('keydown', closeHistory);
        return () => window.removeEventListener('keydown', closeHistory);
    }, [isHistoryOpen]);

    useEffect(() => {
        if (!isCompactLayout || !isMobileDrawerOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        mobileDrawerCloseRef.current?.focus();

        function handleDrawerKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                dispatchWorkspacePanel({ type: 'mobile-close' });
                return;
            }
            if (event.key !== 'Tab' || !inputPanelRef.current) return;

            const focusable = [...inputPanelRef.current.querySelectorAll(
                'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
            )].filter(element => !element.closest('[inert]') && element.getClientRects().length > 0);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || !inputPanelRef.current.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !inputPanelRef.current.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        }

        window.addEventListener('keydown', handleDrawerKeyDown);
        return () => {
            window.removeEventListener('keydown', handleDrawerKeyDown);
            document.body.style.overflow = previousOverflow;
            if (window.matchMedia('(max-width: 960px)').matches && mobileDrawerToggleRef.current?.isConnected) {
                mobileDrawerToggleRef.current.focus();
            }
        };
    }, [isCompactLayout, isMobileDrawerOpen]);

    useEffect(() => {
        if (!isImageExpanded) return undefined;
        function closeExpandedImage(event) {
            if (event.key === 'Escape') setIsImageExpanded(false);
        }
        window.addEventListener('keydown', closeExpandedImage);
        return () => window.removeEventListener('keydown', closeExpandedImage);
    }, [isImageExpanded]);

    function chooseProduct(nextProduct) {
        dispatchProductSelection({ type: 'toggle-product', productType: nextProduct });
    }

    function chooseInputMode(mode) {
        setInputMode(mode);
        setReferenceUnavailable(false);
        setChatNotice('');
    }

    function handleMultiViewFile(slotId, file) {
        if (!file) return;
        const validationError = validateStudioImage(file);
        if (validationError) {
            setMultiUploadError(validationError);
            return;
        }
        const previousUrl = multiViews[slotId]?.url;
        if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
            multiUrlsRef.current = multiUrlsRef.current.filter(url => url !== previousUrl);
        }
        const url = URL.createObjectURL(file);
        multiUrlsRef.current.push(url);
        setMultiViews(current => ({ ...current, [slotId]: { file, url } }));
        setMultiUploadError('');
        setSelectedMultiView(slotId);
    }

    function removeMultiView(slotId) {
        const url = multiViews[slotId]?.url;
        if (url) {
            URL.revokeObjectURL(url);
            multiUrlsRef.current = multiUrlsRef.current.filter(item => item !== url);
        }
        if (selectedMultiView === slotId) {
            const remaining = viewSlots.find(slot => slot.id !== slotId && multiViews[slot.id]);
            setSelectedMultiView(remaining?.id || 'front');
        }
        setMultiViews(current => {
            const next = { ...current };
            delete next[slotId];
            return next;
        });
    }

    function addExtraViewSlot() {
        if (extraViewSlots.length >= 4) return;
        const nextNumber = extraViewSlots.length + 1;
        const slot = { id: `extra-${nextNumber}`, label: `Góc bổ sung ${nextNumber}` };
        setExtraViewSlots(current => [...current, slot]);
    }

    function openEditChat(mode = 'direct-3d') {
        dispatchWorkspacePanel({ type: 'open-chat' });
        setChatMode(mode);
    }

    function closeEditChat() {
        dispatchWorkspacePanel({ type: 'close-chat' });
    }

    function resetStudioSelections() {
        multiUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        multiUrlsRef.current = [];
        setMultiViews({});
        setExtraViewSlots([]);
        setSelectedMultiView('front');
        dispatchProductSelection({ type: 'reset' });
        dispatchWorkspacePanel({ type: 'reset' });
        dispatchHistoryDrawer({ type: 'close' });
        setInputMode('text');
        setTextPrompt('');
        clearUploadedFile();
        setReferenceUnavailable(false);
        setChatPrompt('');
        setChatAttachment(null);
        setChatNotice('');
        onResetPreview?.();
    }

    function handleHistoryClick() {
        dispatchHistoryDrawer({ type: 'trigger-click' });
    }

    function showReferenceUnavailable() {
        setReferenceUnavailable(true);
    }

    function submitEditRequest(event) {
        event.preventDefault();
        setChatNotice('Tính năng chỉnh sửa chưa khả dụng. Yêu cầu này chưa được gửi và mô hình chưa thay đổi.');
    }

    function applySidebarWidth(requestedWidth, persist = false) {
        const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width || workspaceMetrics.width;
        if (workspaceWidth <= 0) return;
        const nextWidth = clampStudioSidebarWidth(requestedWidth, workspaceWidth, workspaceMetrics.dividerWidth);
        sidebarWidthRef.current = nextWidth;
        setSidebarWidth(nextWidth);
        if (persist) {
            try {
                writeStudioSidebarWidth(window.localStorage, nextWidth);
            } catch {
                // Resizing remains available when browser storage is disabled.
            }
        }
    }

    function startSidebarResize(event) {
        if (isCompactLayout || panelCollapsed || event.button !== 0) return;
        const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width || workspaceMetrics.width;
        const currentWidth = sidebarRef.current?.getBoundingClientRect().width || effectiveSidebarWidth;
        if (workspaceWidth <= 0) return;
        event.preventDefault();
        resizeStartRef.current = { pointerId: event.pointerId, x: event.clientX, width: currentWidth };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setIsSidebarResizing(true);
    }

    function moveSidebarResize(event) {
        const start = resizeStartRef.current;
        if (!start || start.pointerId !== event.pointerId) return;
        applySidebarWidth(start.width + event.clientX - start.x);
    }

    function finishSidebarResize(event) {
        const start = resizeStartRef.current;
        if (!start || (event?.pointerId !== undefined && start.pointerId !== event.pointerId)) return;
        resizeStartRef.current = null;
        setIsSidebarResizing(false);
        try {
            writeStudioSidebarWidth(window.localStorage, sidebarWidthRef.current);
        } catch {
            // Resizing remains available when browser storage is disabled.
        }
        if (event?.currentTarget?.hasPointerCapture?.(start.pointerId)) {
            event.currentTarget.releasePointerCapture(start.pointerId);
        }
    }

    function handleSidebarResizeKeyDown(event) {
        const { min, max } = getStudioSidebarBounds(workspaceMetrics.width, workspaceMetrics.dividerWidth);
        const nextWidth = getStudioSidebarKeyboardWidth(effectiveSidebarWidth, event.key, { min, max });
        if (nextWidth === null) return;
        event.preventDefault();
        applySidebarWidth(nextWidth, true);
    }

    const inputReady = hasSelection && (
        inputMode === 'text' ? Boolean(textPrompt.trim())
            : inputMode === 'image' ? Boolean(uploadedImg)
                : viewSlots.some(slot => multiViews[slot.id])
    );

    return (
        <div className={`ai-studio-page ${panelCollapsed ? 'ai-studio-page--panel-collapsed' : ''} ${isCompactLayout ? 'ai-studio-page--compact' : ''} ${isMobileDrawerOpen ? 'ai-studio-page--drawer-open' : ''}`}>
            <div className="ai-studio__container">
                <div
                    ref={workspaceRef}
                    className={`ai-studio__workspace ${isSidebarResizing ? 'is-resizing' : ''}`}
                    style={{ '--studio-sidebar-width': `${effectiveSidebarWidth}px` }}
                >
                    {isCompactLayout && isMobileDrawerOpen && <button
                        type="button"
                        className="ai-studio__drawer-backdrop"
                        aria-label="Đóng bảng ý tưởng"
                        onClick={() => dispatchWorkspacePanel({ type: 'mobile-close' })}
                    />}
                    <aside ref={sidebarRef} className={`ai-studio__sidebar ${panelCollapsed ? 'is-collapsed' : ''} ${isMobileDrawerOpen ? 'is-mobile-open' : ''}`} aria-label="Công cụ tạo mô hình">
                        <div className="ai-studio__sidebar-rail">
                            <StudioButton
                                type="button"
                                className="ai-studio__icon-button"
                                title="Mở bảng ý tưởng"
                                aria-label="Mở bảng ý tưởng"
                                aria-expanded="false"
                                aria-controls="studio-input-panel"
                                onClick={() => dispatchWorkspacePanel({ type: 'toggle-panel' })}
                            ><Icon>left_panel_open</Icon></StudioButton>
                        </div>
                        <section
                            ref={inputPanelRef}
                            id="studio-input-panel"
                            className="ai-studio__input-panel"
                            aria-label="Bảng tạo mô hình"
                            aria-hidden={isCompactLayout ? !isMobileDrawerOpen : panelCollapsed}
                            inert={isCompactLayout ? !isMobileDrawerOpen : panelCollapsed}
                        >
                            <div className="ai-studio__panel-heading">
                                <div>
                                    <p className="ai-studio__eyebrow">Bắt đầu sáng tạo</p>
                                    <h2>Ý tưởng của bạn</h2>
                                </div>
                                <div className="ai-studio__panel-controls">
                                    <StudioButton type="button" className="ai-studio__icon-button ai-studio__reset-button" onClick={resetStudioSelections} title="Làm mới lựa chọn" aria-label="Làm mới lựa chọn">
                                        <Icon>refresh</Icon>
                                    </StudioButton>
                                    <StudioButton ref={mobileDrawerCloseRef} type="button" className="ai-studio__icon-button ai-studio__mobile-close" onClick={() => dispatchWorkspacePanel({ type: 'mobile-close' })} title="Đóng bảng ý tưởng" aria-label="Đóng bảng ý tưởng">
                                        <Icon>close</Icon>
                                    </StudioButton>
                                    <StudioButton type="button" className="ai-studio__icon-button ai-studio__desktop-collapse" onClick={() => dispatchWorkspacePanel({ type: 'toggle-panel' })} title="Thu gọn bảng ý tưởng" aria-label="Thu gọn bảng ý tưởng" aria-expanded="true" aria-controls="studio-input-panel">
                                        <Icon>left_panel_close</Icon>
                                    </StudioButton>
                                </div>
                            </div>

                            <fieldset className="ai-studio__choice-group">
                                <legend>Chọn sản phẩm</legend>
                                <div className="ai-studio__product-options">
                                    {PRODUCTS.map(product => (
                                        <button key={product.id} type="button" aria-pressed={productType === product.id} onClick={() => chooseProduct(product.id)} className={`ai-studio__choice ${productType === product.id ? 'is-selected' : ''}`}>
                                            {product.label}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>

                            {productType && (
                                <fieldset className="ai-studio__choice-group">
                                    <legend>Kiểu thiết kế <span>(tối đa 3)</span></legend>
                                    <div className="ai-studio__design-options">
                                        {availableDesignTypes.map(type => {
                                            const selected = designTypes.includes(type);
                                            return <button key={type} type="button" aria-pressed={selected} onClick={() => dispatchProductSelection({ type: 'toggle-design', designType: type })} className={`ai-studio__choice ${selected ? 'is-selected' : ''}`}>
                                                {selected && <Icon>check</Icon>}{type}
                                            </button>;
                                        })}
                                    </div>
                                    <p className="ai-studio__helper">Lựa chọn sản phẩm và kiểu thiết kế chưa được gửi lên máy chủ vì API hiện tại chưa có trường tương ứng.</p>
                                </fieldset>
                            )}

                            {hasSelection && (
                                <>
                                    <div className="ai-studio__input-block">
                                        <p className="ai-studio__field-label">Chọn cách nhập ý tưởng</p>
                                        <div className="ai-studio__mode-tabs" role="tablist" aria-label="Chế độ nhập ý tưởng">
                                            {INPUT_MODES.map(mode => <button key={mode.id} type="button" role="tab" aria-selected={inputMode === mode.id} onClick={() => chooseInputMode(mode.id)}>
                                                <Icon>{mode.icon}</Icon><span>{mode.label}</span>
                                            </button>)}
                                        </div>
                                    </div>

                                    {inputMode === 'text' && (
                                        <label className="ai-studio__input-block">
                                            <span className="ai-studio__field-label">Mô tả ý tưởng</span>
                                            <textarea value={textPrompt} onChange={event => setTextPrompt(event.target.value)} placeholder="Mô tả hình dáng hoặc ý tưởng bạn muốn tạo…" rows={5} />
                                        </label>
                                    )}

                                    {inputMode === 'image' && (
                                        <div className="ai-studio__input-block">
                                            <p className="ai-studio__field-label">Ảnh tham chiếu</p>
                                            <input ref={singleFileRef} type="file" accept="image/*" onChange={event => { onUploadFile(event.target.files?.[0]); event.target.value = ''; }} hidden aria-label="Chọn ảnh tham chiếu" />
                                            <button type="button" className="ai-studio__upload-zone" onClick={() => singleFileRef.current?.click()}>
                                                <Icon>{uploadedImg ? 'photo_camera' : 'add_photo_alternate'}</Icon>
                                                <span>{uploadedImg ? 'Chọn ảnh khác' : 'Tải lên một ảnh'}</span>
                                                <small>Chọn ảnh từ thiết bị của bạn</small>
                                            </button>
                                            {uploadError && <p className="ai-studio__error" role="alert">{uploadError}</p>}
                                            {uploadedImg && <StudioButton type="button" className="ai-studio__button--text" onClick={clearUploadedFile}>Gỡ ảnh đã chọn</StudioButton>}
                                        </div>
                                    )}

                                    {inputMode === 'multi' && (
                                        <div className="ai-studio__input-block">
                                            <p className="ai-studio__field-label">Ảnh nhiều góc nhìn</p>
                                            <p className="ai-studio__helper">Thêm các góc nhìn đang có. Chế độ gửi nhiều ảnh chưa được API hiện tại hỗ trợ.</p>
                                            <div className="ai-studio__view-slots">
                                                {viewSlots.map(slot => <div className="ai-studio__view-slot" key={slot.id}>
                                                    <input ref={node => { multiFileRefs.current[slot.id] = node; }} type="file" accept="image/*" hidden aria-label={`Chọn ảnh góc ${slot.label}`} onChange={event => { handleMultiViewFile(slot.id, event.target.files?.[0]); event.target.value = ''; }} />
                                                    <button type="button" aria-pressed={Boolean(multiViews[slot.id])} onClick={() => multiFileRefs.current[slot.id]?.click()}>
                                                        {multiViews[slot.id] ? <img src={multiViews[slot.id].url} alt={`Góc ${slot.label}`} /> : <Icon>add</Icon>}
                                                        <span>{slot.label}</span>
                                                    </button>
                                                    {multiViews[slot.id] && <StudioButton type="button" className="ai-studio__button--text" onClick={() => removeMultiView(slot.id)}>Gỡ</StudioButton>}
                                                </div>)}
                                            </div>
                                            <StudioButton type="button" className="ai-studio__button--text" onClick={addExtraViewSlot}><Icon>add</Icon>Thêm góc bổ sung</StudioButton>
                                            {multiUploadError && <p className="ai-studio__error" role="alert">{multiUploadError}</p>}
                                        </div>
                                    )}

                                    <div className="ai-studio__submit-block">
                                        <StudioButton type="button" className="ai-studio__button--primary" disabled={!inputReady} onClick={showReferenceUnavailable}>
                                            <Icon>auto_awesome</Icon>Tạo ảnh tham chiếu
                                        </StudioButton>
                                        {referenceUnavailable && <p className="ai-studio__notice" role="status">Tạo ảnh tham chiếu chưa khả dụng vì Backend chưa có API đã xác minh cho bước này. Chưa có ảnh mới nào được tạo.</p>}
                                        {inputMode === 'text' && <StudioButton type="button" className="ai-studio__button--secondary" disabled={!canSubmit || !inputReady || !validApiMode || isGenerating || isGenerationPending} onClick={onGenerate}>
                                            {isGenerating ? 'Đang gửi yêu cầu…' : 'Tạo mô hình 3D trực tiếp từ mô tả'}
                                        </StudioButton>}
                                        {inputMode === 'multi' && <p className="ai-studio__notice" role="status">Chưa thể gửi nhiều góc nhìn: API hiện tại chỉ nhận một ảnh hoặc mô tả.</p>}
                                    </div>
                                </>
                            )}
                    </section>
                    </aside>

                    {!isCompactLayout && !panelCollapsed && workspaceMetrics.width > 0 && <div
                        ref={resizeHandleRef}
                        className="ai-studio__resize-handle"
                        role="separator"
                        tabIndex={0}
                        aria-label="Thay đổi độ rộng bảng ý tưởng"
                        aria-orientation="vertical"
                        aria-valuemin={getStudioSidebarBounds(workspaceMetrics.width, workspaceMetrics.dividerWidth).min}
                        aria-valuemax={getStudioSidebarBounds(workspaceMetrics.width, workspaceMetrics.dividerWidth).max}
                        aria-valuenow={effectiveSidebarWidth}
                        aria-valuetext={`${effectiveSidebarWidth} pixel`}
                        title="Kéo để thay đổi độ rộng bảng ý tưởng; dùng phím mũi tên để điều chỉnh"
                        onPointerDown={startSidebarResize}
                        onPointerMove={moveSidebarResize}
                        onPointerUp={finishSidebarResize}
                        onPointerCancel={finishSidebarResize}
                        onLostPointerCapture={finishSidebarResize}
                        onKeyDown={handleSidebarResizeKeyDown}
                    ><span aria-hidden="true" /></div>}

                    <section className="ai-studio__preview-panel" aria-label="Vùng xem trước">
                        <div className="ai-studio__mobile-tools">
                            <StudioButton
                                ref={mobileDrawerToggleRef}
                                type="button"
                                className="ai-studio__button--subtle ai-studio__mobile-open"
                                title={isMobileDrawerOpen ? 'Bảng ý tưởng đang mở' : 'Mở bảng ý tưởng'}
                                aria-label={isMobileDrawerOpen ? 'Bảng ý tưởng đang mở' : 'Mở bảng ý tưởng'}
                                aria-expanded={isMobileDrawerOpen}
                                aria-controls="studio-input-panel"
                                onClick={() => dispatchWorkspacePanel({ type: 'mobile-open' })}
                            ><Icon>tune</Icon><span>Ý tưởng của bạn</span></StudioButton>
                        </div>
                        <div className="ai-studio__preview-stage">
                                <div className="ai-studio__stage-toolbar">
                                <span>{isGenerated ? 'Mô hình 3D' : inputMode === 'multi' ? `Góc ${viewSlots.find(slot => slot.id === selectedMultiView)?.label || 'Trước'}` : 'Ảnh 2D'}</span>
                                <div className="ai-studio__history-anchor" onMouseEnter={() => dispatchHistoryDrawer({ type: 'hover-enter' })} onMouseLeave={() => dispatchHistoryDrawer({ type: 'hover-leave' })}>
                                    <StudioButton type="button" className="ai-studio__button--subtle" aria-expanded={isHistoryOpen} onClick={handleHistoryClick}>
                                        <Icon>history</Icon><span>Lịch sử</span>
                                    </StudioButton>
                                    {isHistoryOpen && <aside id="studio-history-drawer" className="ai-studio__history-drawer" aria-label="Lịch sử tạo sinh">
                                        <div className="ai-studio__drawer-heading">
                                            <strong>Lịch sử phiên này</strong>
                                            <StudioButton type="button" className="ai-studio__icon-button" onClick={() => dispatchHistoryDrawer({ type: 'pin-toggle' })} aria-pressed={isHistoryPinned} aria-label={isHistoryPinned ? 'Bỏ ghim lịch sử' : 'Ghim lịch sử'}><Icon>{isHistoryPinned ? 'push_pin' : 'keep'}</Icon></StudioButton>
                                            <StudioButton type="button" className="ai-studio__icon-button" onClick={() => dispatchHistoryDrawer({ type: 'close' })} aria-label="Đóng lịch sử"><Icon>close</Icon></StudioButton>
                                        </div>
                                        {historyItems.length === 0 ? <p className="ai-studio__history-empty">Chưa có mô hình hoàn tất trong phiên này.</p> : <div className="ai-studio__history-list">
                                            {historyItems.map(item => <button type="button" key={item.id || item.modelUrl} onClick={() => { onSelectGeneration(item); dispatchHistoryDrawer({ type: 'close' }); }}>
                                                {item.img ? <img src={item.img} alt="" /> : <Icon>view_in_ar</Icon>}
                                                <span>{item.title || 'Mô hình đã tạo'}</span>
                                            </button>)}
                                        </div>}
                                    </aside>}
                                </div>
                            </div>
                            {(genError || genStatus) && <div className={`ai-studio__stage-status ${genError ? 'is-error' : ''}`}>
                                {genError && <p role="alert">{genError}</p>}
                                {!genError && genStatus && <p role="status">{genStatus}</p>}
                                {isGenerationPending && <StudioButton type="button" className="ai-studio__button--secondary" onClick={onAllowNewRequest}>Gửi một yêu cầu mới</StudioButton>}
                            </div>}

                            <div className={`ai-studio__stage-content ${isGenerated ? 'is-model' : ''}`}>
                                {isGenerated ? modelViewer : previewImage ? <button type="button" className="ai-studio__image-preview" onClick={() => setIsImageExpanded(true)} aria-label="Phóng to ảnh tham chiếu">
                                    <img src={previewImage} alt={inputMode === 'multi' ? `Ảnh góc ${viewSlots.find(slot => slot.id === selectedMultiView)?.label}` : 'Ảnh tham chiếu đã chọn'} style={{ transform: `scale(${imageZoom})` }} />
                                </button> : <div className="ai-studio__empty-state">
                                    <div className="ai-studio__empty-art" aria-hidden="true"><span className="ai-studio__art-shape ai-studio__art-shape--one" /><span className="ai-studio__art-shape ai-studio__art-shape--two" /><Icon>view_in_ar</Icon></div>
                                    <h2>Hôm nay bạn muốn tạo gì bằng 3D?</h2>
                                    <p>Chọn sản phẩm, kiểu thiết kế và cách nhập ý tưởng để bắt đầu.</p>
                                    <ul><li>Chọn sản phẩm và kiểu thiết kế.</li><li>Nhập mô tả hoặc tải ảnh tham chiếu.</li><li>Tạo mô hình khi API hiện tại hỗ trợ cách nhập đã chọn.</li></ul>
                                </div>}
                            </div>

                            {!isGenerated && previewImage && <div className="ai-studio__image-controls" aria-label="Điều khiển ảnh">
                                <StudioButton type="button" className="ai-studio__icon-button" onClick={() => setImageZoom(value => Math.max(.5, value - .15))} aria-label="Thu nhỏ ảnh"><Icon>zoom_out</Icon></StudioButton>
                                <StudioButton type="button" className="ai-studio__icon-button" onClick={() => setImageZoom(value => Math.min(2.5, value + .15))} aria-label="Phóng to ảnh"><Icon>zoom_in</Icon></StudioButton>
                                <StudioButton type="button" className="ai-studio__icon-button" onClick={() => setImageZoom(1)} aria-label="Đặt lại kích thước ảnh"><Icon>restart_alt</Icon></StudioButton>
                            </div>}

                            {!isGenerated && inputMode === 'multi' && viewSlots.some(slot => multiViews[slot.id]) && <div className="ai-studio__thumbnails" aria-label="Ảnh thu nhỏ các góc nhìn">
                                    {viewSlots.filter(slot => multiViews[slot.id]).map(slot => <button type="button" key={slot.id} aria-pressed={selectedMultiView === slot.id} onClick={() => setSelectedMultiView(slot.id)}>
                                    <img src={multiViews[slot.id].url} alt="" /><span>{slot.label}</span>
                                </button>)}
                            </div>}

                            {isGenerated && <div className="ai-studio__model-actions">
                                <StudioButton type="button" className="ai-studio__button--secondary" onClick={() => openEditChat('direct-3d')}>Chỉnh sửa</StudioButton>
                                <StudioButton type="button" className="ai-studio__button--primary" onClick={onPrintAction}>Tiến tới đánh giá in</StudioButton>
                            </div>}

                            {!isGenerated && inputMode === 'image' && uploadedImg && <div className="ai-studio__model-actions">
                                <StudioButton type="button" className="ai-studio__button--secondary" onClick={() => openEditChat('image-then-3d')}>Chỉnh sửa ảnh</StudioButton>
                                <StudioButton type="button" className="ai-studio__button--primary" disabled={!canSubmit || isGenerating || isGenerationPending} onClick={onGenerate}>{isGenerating ? 'Đang gửi yêu cầu…' : 'Tạo mô hình 3D'}</StudioButton>
                            </div>}

                            {!isGenerated && inputMode === 'multi' && previewImage && <div className="ai-studio__model-actions"><p className="ai-studio__notice">Tạo model từ nhiều ảnh chưa được hỗ trợ bởi API hiện tại.</p></div>}
                        </div>

                        {isChatOpen && <section className="ai-studio__chat" aria-label="Chỉnh sửa bằng hội thoại">
                            <header><div><p className="ai-studio__eyebrow">Không gian chỉnh sửa</p><h2>Trao đổi về thiết kế</h2></div><StudioButton type="button" className="ai-studio__icon-button" onClick={closeEditChat} aria-label="Đóng khung chỉnh sửa"><Icon>close</Icon></StudioButton></header>
                            {isGenerated && <div className="ai-studio__chat-modes" role="group" aria-label="Cách chỉnh sửa">
                                <button type="button" aria-pressed={chatMode === 'direct-3d'} onClick={() => setChatMode('direct-3d')}>Chỉnh trực tiếp 3D</button>
                                <button type="button" aria-pressed={chatMode === 'image-then-3d'} onClick={() => setChatMode('image-then-3d')}>Chỉnh ảnh 2D rồi tạo lại 3D</button>
                            </div>}
                            <div className="ai-studio__chat-empty">Chưa có trao đổi trong phiên này. Gửi yêu cầu chỉnh sửa sẽ chỉ khả dụng khi API chỉnh sửa được tích hợp.</div>
                            <form onSubmit={submitEditRequest}>
                                <textarea value={chatPrompt} onChange={event => setChatPrompt(event.target.value)} placeholder="Mô tả thay đổi bạn muốn…" aria-label="Yêu cầu chỉnh sửa" />
                                <div className="ai-studio__chat-actions">
                                    <label className="ai-studio__attach-button"><Icon>attach_file</Icon><span>Đính kèm ảnh</span><input type="file" accept="image/*" onChange={event => setChatAttachment(event.target.files?.[0] || null)} /></label>
                                    {chatAttachment && <span className="ai-studio__attachment-name">{chatAttachment.name}</span>}
                                    <StudioButton type="submit" className="ai-studio__button--primary" disabled={!chatPrompt.trim() && !chatAttachment}><Icon>send</Icon>Gửi yêu cầu</StudioButton>
                                </div>
                            </form>
                            {chatNotice && <p className="ai-studio__notice" role="status">{chatNotice}</p>}
                        </section>}
                    </section>
                </div>

                {isImageExpanded && previewImage && <div className="ai-studio__image-lightbox" role="dialog" aria-modal="true" aria-label="Ảnh tham chiếu phóng to" onClick={() => setIsImageExpanded(false)}>
                    <StudioButton type="button" className="ai-studio__icon-button" onClick={() => setIsImageExpanded(false)} aria-label="Đóng ảnh"><Icon>close</Icon></StudioButton>
                    <img src={previewImage} alt="Ảnh tham chiếu phóng to" onClick={event => event.stopPropagation()} />
                </div>}
            </div>
        </div>
    );
}
