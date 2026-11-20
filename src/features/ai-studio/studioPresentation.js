export const STYLES_BY_PRODUCT = Object.freeze({
    keychain: Object.freeze({
        ordinary: Object.freeze([
            Object.freeze({ id: 'cute-mascot', label: 'Cute Mascot' }),
            Object.freeze({ id: 'chibi', label: 'Chibi' }),
            Object.freeze({ id: 'cartoon', label: 'Cartoon' }),
            Object.freeze({ id: 'minimalist', label: 'Minimalist' }),
            Object.freeze({ id: 'low-poly', label: 'Low Poly' }),
        ]),
        click: Object.freeze([
            Object.freeze({ id: 'mini-chibi', label: 'Mini Chibi' }),
            Object.freeze({ id: 'mini-mascot', label: 'Mini Mascot' }),
            Object.freeze({ id: 'minimalist-click', label: 'Minimalist Click' }),
            Object.freeze({ id: 'pixel-voxel', label: 'Pixel/Voxel' }),
        ]),
    }),
    'night-light': Object.freeze([
        Object.freeze({ id: 'minimalist-glow', label: 'Minimalist Glow' }),
        Object.freeze({ id: 'kawaii-night-light', label: 'Kawaii Night Light' }),
        Object.freeze({ id: 'fantasy-glow', label: 'Fantasy Glow' }),
        Object.freeze({ id: 'geometric-glow', label: 'Geometric Glow' }),
        Object.freeze({ id: 'architectural-miniature', label: 'Architectural Miniature' }),
    ]),
    figure: Object.freeze([
        Object.freeze({ id: 'chibi-collectible', label: 'Chibi Collectible' }),
        Object.freeze({ id: 'anime-figure', label: 'Anime Figure' }),
        Object.freeze({ id: 'cartoon-sculpture', label: 'Cartoon Sculpture' }),
        Object.freeze({ id: 'semi-realistic', label: 'Semi-Realistic' }),
        Object.freeze({ id: 'fantasy-sculpture', label: 'Fantasy Sculpture' }),
        Object.freeze({ id: 'low-poly-sculpture', label: 'Low Poly Sculpture' }),
    ]),
});

export const MULTI_VIEW_SLOTS = Object.freeze([
    Object.freeze({ id: 'front', label: 'Trước' }),
    Object.freeze({ id: 'left', label: 'Trái' }),
    Object.freeze({ id: 'right', label: 'Phải' }),
    Object.freeze({ id: 'back', label: 'Sau' }),
]);

export function getStylesForProduct(productType, keychainVariant = 'ordinary') {
    if (productType === 'keychain') {
        return STYLES_BY_PRODUCT.keychain[keychainVariant] || STYLES_BY_PRODUCT.keychain.ordinary;
    }
    return STYLES_BY_PRODUCT[productType] || [];
}

export function getValidStyleForProduct(productType, keychainVariant, selectedStyleId) {
    const styles = getStylesForProduct(productType, keychainVariant);
    return styles.some(style => style.id === selectedStyleId) ? selectedStyleId : styles[0]?.id || '';
}

export function isStudioGenerateActionDisabled({
    inputMode,
    inputReady = false,
    isGenerating = false,
    activeJobId = null,
    requestIndeterminate = false,
} = {}) {
    if (isGenerating) return true;
    if (activeJobId) return false;
    if (inputMode === 'multi') return true;
    return !inputReady && !requestIndeterminate;
}

export const initialStudioProductSelectionState = Object.freeze({
    productType: null,
});

export function studioProductSelectionReducer(state = initialStudioProductSelectionState, action) {
    if (action.type === 'reset') return initialStudioProductSelectionState;

    if (action.type === 'toggle-product') {
        const productType = state.productType === action.productType ? null : action.productType;
        return { productType };
    }

    return state;
}

export function getStudioWorkflowSteps({
    projectState = { phase: 'idle' },
    pipelineState = { phase: 'idle' },
} = {}) {
    const projectLoaded = projectState?.phase === 'loaded'
        && typeof projectState.project?.projectId === 'string'
        && projectState.project.projectId.length > 0;
    const pipeline = pipelineState?.pipeline;
    const knownProjectStatuses = new Set([
        'DRAFT', 'REFERENCES_QUEUED', 'REFERENCES_GENERATING', 'REFERENCES_REVIEW',
        'REFERENCES_APPROVED', 'MODEL_QUEUED', 'MODEL_GENERATING', 'MODEL_REVIEW', 'COMPLETED', 'FAILED',
    ]);
    const references = Array.isArray(pipeline?.referenceVersions) ? pipeline.referenceVersions : [];
    const models = Array.isArray(pipeline?.modelVersions) ? pipeline.modelVersions : [];
    const jobs = Array.isArray(pipeline?.jobs) ? pipeline.jobs : [];
    const latestReference = references.at(-1);
    const latestModel = models.at(-1);
    const failedJob = [...jobs].reverse().find((job) => job.status === 'FAILED');
    const projectStatus = pipeline?.projectStatus;
    const hasRecognizedProjectStatus = knownProjectStatuses.has(projectStatus);
    const hasPipeline = pipelineState?.phase === 'ready' || pipelineState?.phase === 'empty';
    const notStarted = (detail) => ({ status: 'not-started', detail });
    const unavailable = (detail) => ({ status: 'unavailable', detail });
    const confirmed = (detail) => ({ status: 'confirmed', detail });
    const processing = (detail) => ({ status: 'processing', detail });
    const waiting = (detail) => ({ status: 'waiting-user', detail });
    const failed = (detail) => ({ status: 'failed', detail });

    let referencesStep = notStarted('Chưa bắt đầu tạo ảnh tham chiếu.');
    let referenceApprovalStep = notStarted('Chưa có ảnh tham chiếu để duyệt.');
    let modelStep = notStarted('Chưa bắt đầu tạo model.');
    let modelApprovalStep = notStarted('Chưa có model để duyệt.');
    let completionStep = notStarted('Workflow chưa hoàn tất.');
    if (projectState?.phase === 'error' || projectState?.phase === 'auth-required') {
        referencesStep = unavailable('Không thể xác nhận dự án từ Backend.');
        referenceApprovalStep = unavailable('Không thể xác nhận dự án từ Backend.');
        modelStep = unavailable('Không thể xác nhận dự án từ Backend.');
        modelApprovalStep = unavailable('Không thể xác nhận dự án từ Backend.');
        completionStep = unavailable('Không thể xác nhận dự án từ Backend.');
    } else if (!projectLoaded) {
        referencesStep = notStarted('Lưu hoặc mở một dự án để bắt đầu.');
        referenceApprovalStep = notStarted('Lưu hoặc mở một dự án để bắt đầu.');
        modelStep = notStarted('Lưu hoặc mở một dự án để bắt đầu.');
        modelApprovalStep = notStarted('Lưu hoặc mở một dự án để bắt đầu.');
        completionStep = notStarted('Lưu hoặc mở một dự án để bắt đầu.');
    } else if (!hasPipeline) {
        const state = pipelineState?.phase === 'loading' ? processing : unavailable;
        const detail = pipelineState?.phase === 'loading'
            ? 'Đang đọc trạng thái từ Backend.'
            : 'Trạng thái chưa được Backend xác nhận.';
        referencesStep = state(detail);
        referenceApprovalStep = state(detail);
        modelStep = state(detail);
        modelApprovalStep = state(detail);
        completionStep = state(detail);
    } else if (!hasRecognizedProjectStatus) {
        referencesStep = unavailable('Backend trả về trạng thái dự án chưa nhận diện.');
        referenceApprovalStep = unavailable('Backend trả về trạng thái dự án chưa nhận diện.');
        modelStep = unavailable('Backend trả về trạng thái dự án chưa nhận diện.');
        modelApprovalStep = unavailable('Backend trả về trạng thái dự án chưa nhận diện.');
        completionStep = unavailable('Backend trả về trạng thái dự án chưa nhận diện.');
    } else {
        const failedReferenceJob = failedJob?.stage === 'REFERENCE_IMAGE';
        const failedModelJob = failedJob?.stage === 'MODEL_MESH';
        const referenceStatus = latestReference?.status;
        const modelStatus = latestModel?.status;
        if (['REFERENCES_QUEUED', 'REFERENCES_GENERATING'].includes(projectStatus)
            || referenceStatus === 'GENERATING') {
            referencesStep = processing('Backend đang tạo ảnh tham chiếu.');
        } else if (referenceStatus === 'FAILED' || projectStatus === 'FAILED' && failedReferenceJob) {
            referencesStep = failed('Backend báo tạo ảnh tham chiếu thất bại.');
        } else if (['READY_FOR_REVIEW', 'APPROVED', 'CHANGES_REQUESTED'].includes(referenceStatus)) {
            referencesStep = confirmed('Backend đã ghi nhận ảnh tham chiếu.');
        } else if (referenceStatus && !['GENERATING', 'FAILED'].includes(referenceStatus)) {
            referencesStep = unavailable('Trạng thái ảnh tham chiếu chưa nhận diện.');
        }

        if (referenceStatus === 'READY_FOR_REVIEW' && projectStatus === 'REFERENCES_REVIEW') {
            referenceApprovalStep = waiting('Ảnh tham chiếu đang chờ bạn duyệt.');
        } else if (referenceStatus === 'APPROVED') {
            referenceApprovalStep = confirmed('Backend đã xác nhận duyệt ảnh tham chiếu.');
        } else if (referenceStatus === 'CHANGES_REQUESTED') {
            referenceApprovalStep = waiting('Backend đã ghi nhận yêu cầu chỉnh sửa ảnh tham chiếu.');
        } else if (referenceStatus === 'FAILED' || projectStatus === 'FAILED' && failedReferenceJob) {
            referenceApprovalStep = failed('Ảnh tham chiếu chưa thể duyệt vì công việc thất bại.');
        } else if (referenceStatus && !['GENERATING', 'READY_FOR_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'FAILED'].includes(referenceStatus)) {
            referenceApprovalStep = unavailable('Trạng thái duyệt ảnh chưa nhận diện.');
        }

        if (['MODEL_QUEUED', 'MODEL_GENERATING'].includes(projectStatus) || modelStatus === 'GENERATING') {
            modelStep = processing('Backend đang tạo model 3D.');
        } else if (modelStatus === 'FAILED' || projectStatus === 'FAILED' && failedModelJob) {
            modelStep = failed('Backend báo tạo model thất bại.');
        } else if (['READY_FOR_REVIEW', 'APPROVED', 'CHANGES_REQUESTED'].includes(modelStatus)) {
            modelStep = confirmed('Backend đã ghi nhận phiên bản model.');
        } else if (modelStatus && !['GENERATING', 'FAILED'].includes(modelStatus)) {
            modelStep = unavailable('Trạng thái model chưa nhận diện.');
        }

        if (modelStatus === 'READY_FOR_REVIEW' && projectStatus === 'MODEL_REVIEW') {
            modelApprovalStep = waiting('Model đang chờ bạn duyệt.');
        } else if (modelStatus === 'APPROVED') {
            modelApprovalStep = confirmed('Backend đã xác nhận duyệt model.');
        } else if (modelStatus === 'CHANGES_REQUESTED') {
            modelApprovalStep = waiting('Backend đã ghi nhận yêu cầu chỉnh sửa model.');
        } else if (modelStatus === 'FAILED' || projectStatus === 'FAILED' && failedModelJob) {
            modelApprovalStep = failed('Model chưa thể duyệt vì công việc thất bại.');
        } else if (modelStatus && !['GENERATING', 'READY_FOR_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'FAILED'].includes(modelStatus)) {
            modelApprovalStep = unavailable('Trạng thái duyệt model chưa nhận diện.');
        }

        if (projectStatus === 'COMPLETED' && modelStatus === 'APPROVED' && latestModel?.artifactAvailable === true) {
            completionStep = confirmed('Backend xác nhận model đã duyệt và dự án đã hoàn tất.');
        } else if (projectStatus === 'FAILED') {
            completionStep = failed('Backend báo workflow thất bại.');
        } else if (projectStatus === 'COMPLETED') {
            completionStep = unavailable('Backend chưa xác nhận model được duyệt cùng artifact.');
        }
    }

    return [
        {
            label: 'Yêu cầu',
            status: projectLoaded ? 'confirmed'
                : ['loading', 'saving', 'indeterminate'].includes(projectState?.phase) ? 'processing'
                    : projectState?.phase === 'error' ? 'failed' : 'not-started',
            detail: projectLoaded ? 'Backend đã xác nhận Design Project.'
                : projectState?.message || 'Lưu hoặc mở một dự án để bắt đầu.',
        },
        { label: 'Ảnh tham chiếu 4 góc', ...referencesStep },
        { label: 'Duyệt ảnh', ...referenceApprovalStep },
        { label: 'Model 3D', ...modelStep },
        { label: 'Duyệt model', ...modelApprovalStep },
        { label: 'Hoàn tất', ...completionStep },
    ];
}

export const initialHistoryDrawerState = Object.freeze({ isOpen: false, isPinned: false });

export function historyDrawerReducer(state = initialHistoryDrawerState, action) {
    switch (action.type) {
        case 'hover-enter':
            return state.isPinned ? state : { isOpen: true, isPinned: false };
        case 'hover-leave':
            return state.isPinned ? state : initialHistoryDrawerState;
        case 'trigger-click':
            if (state.isPinned) return initialHistoryDrawerState;
            return { isOpen: true, isPinned: true };
        case 'pin-toggle':
            return state.isOpen
                ? { ...state, isPinned: !state.isPinned }
                : { isOpen: true, isPinned: true };
        case 'close':
        case 'escape':
            return initialHistoryDrawerState;
        default:
            return state;
    }
}

export const initialEditChatSidebarState = Object.freeze({
    isPanelCollapsed: false,
    isMobileDrawerOpen: false,
    isChatOpen: false,
    previousPanelCollapsed: null,
    previousMobileDrawerOpen: null,
});

export function editChatSidebarReducer(state = initialEditChatSidebarState, action) {
    switch (action.type) {
        case 'toggle-panel':
            return { ...state, isPanelCollapsed: !state.isPanelCollapsed };
        case 'mobile-open':
            return { ...state, isMobileDrawerOpen: true };
        case 'mobile-close':
            return { ...state, isMobileDrawerOpen: false };
        case 'mobile-toggle':
            return { ...state, isMobileDrawerOpen: !state.isMobileDrawerOpen };
        case 'open-chat':
            return {
                isPanelCollapsed: true,
                isMobileDrawerOpen: false,
                isChatOpen: true,
                previousPanelCollapsed: state.isChatOpen ? state.previousPanelCollapsed : state.isPanelCollapsed,
                previousMobileDrawerOpen: state.isChatOpen ? state.previousMobileDrawerOpen : state.isMobileDrawerOpen,
            };
        case 'close-chat':
            return {
                isPanelCollapsed: state.previousPanelCollapsed ?? false,
                isMobileDrawerOpen: state.previousMobileDrawerOpen ?? false,
                isChatOpen: false,
                previousPanelCollapsed: null,
                previousMobileDrawerOpen: null,
            };
        case 'reset':
            return initialEditChatSidebarState;
        default:
            return state;
    }
}

export const initialViewerCustomizationState = Object.freeze({
    modelColor: null,
    partColors: {},
    modelScale: Object.freeze({ x: 100, y: 100, z: 100 }),
});

export function viewerCustomizationReducer(state = initialViewerCustomizationState, action) {
    if (action.type === 'reset-for-model') {
        const parts = Array.isArray(action.parts) ? action.parts : [];
        return {
            modelColor: null,
            partColors: Object.fromEntries(parts
                .filter(part => part && (typeof part.id === 'string' || typeof part.id === 'number'))
                .map(part => [part.id, part.color ?? '#e2e8f0'])),
            modelScale: { x: 100, y: 100, z: 100 },
        };
    }

    if (action.type === 'viewer-change') {
        const customization = action.customization;
        if (!customization || typeof customization !== 'object' || Array.isArray(customization)) return state;
        return {
            modelColor: Object.hasOwn(customization, 'modelColor')
                ? (typeof customization.modelColor === 'string' ? customization.modelColor : state.modelColor)
                : state.modelColor,
            partColors: customization.partColors && typeof customization.partColors === 'object'
                && !Array.isArray(customization.partColors) ? { ...customization.partColors } : state.partColors,
            modelScale: isValidScale(customization.modelScale) ? { ...customization.modelScale } : state.modelScale,
        };
    }

    return state;
}

function isValidScale(scale) {
    return scale && typeof scale === 'object' && !Array.isArray(scale)
        && ['x', 'y', 'z'].every(axis => Number.isFinite(scale[axis]) && scale[axis] > 0);
}

export function viewerCustomizationToPrintDraftOptions(customization) {
    return {
        ...(typeof customization?.modelColor === 'string' ? { modelColor: customization.modelColor } : {}),
        partColors: { ...(customization?.partColors || {}) },
        modelScale: { ...(customization?.modelScale || initialViewerCustomizationState.modelScale) },
    };
}

export function getViewerModelScale(baseDimensions, currentDimensions) {
    if (!baseDimensions || !currentDimensions) return null;
    const axes = ['x', 'y', 'z'];
    if (!axes.every(axis => Number.isFinite(baseDimensions[axis]) && baseDimensions[axis] > 0
        && Number.isFinite(currentDimensions[axis]) && currentDimensions[axis] > 0)) return null;

    return Object.fromEntries(axes.map(axis => [
        axis,
        Number((currentDimensions[axis] / baseDimensions[axis] * 100).toFixed(2)),
    ]));
}

export function getStudioApiInputMode(mode) {
    return mode === 'text' || mode === 'image' ? mode : null;
}
