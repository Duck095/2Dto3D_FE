export const DESIGN_TYPES_BY_PRODUCT = Object.freeze({
    keychain: Object.freeze(['Chibi', 'Động vật', 'Nhân vật', 'Khớp', 'Click']),
    'night-light': Object.freeze(['Kiến trúc', 'Hình hộp tối giản']),
    figure: Object.freeze(['Chibi', 'Anime', 'Động vật', 'Thần thoại', 'Khớp động']),
});

export const MULTI_VIEW_SLOTS = Object.freeze([
    Object.freeze({ id: 'front', label: 'Trước' }),
    Object.freeze({ id: 'left', label: 'Trái' }),
    Object.freeze({ id: 'right', label: 'Phải' }),
    Object.freeze({ id: 'back', label: 'Sau' }),
]);

export function getDesignTypes(productType) {
    return DESIGN_TYPES_BY_PRODUCT[productType] || [];
}

export function toggleDesignType(selectedTypes, designType) {
    const selected = Array.isArray(selectedTypes) ? selectedTypes : [];
    if (selected.includes(designType)) return selected.filter(type => type !== designType);
    if (selected.length >= 3) return selected;
    return [...selected, designType];
}

export function retainValidDesignTypes(productType, selectedTypes) {
    const validTypes = new Set(getDesignTypes(productType));
    return (Array.isArray(selectedTypes) ? selectedTypes : [])
        .filter(type => validTypes.has(type))
        .slice(0, 3);
}

export const initialStudioProductSelectionState = Object.freeze({
    productType: null,
    designTypes: [],
});

export function studioProductSelectionReducer(state = initialStudioProductSelectionState, action) {
    if (action.type === 'reset') return initialStudioProductSelectionState;

    if (action.type === 'toggle-product') {
        const productType = state.productType === action.productType ? null : action.productType;
        return {
            productType,
            designTypes: productType ? retainValidDesignTypes(productType, state.designTypes) : [],
        };
    }

    if (action.type === 'toggle-design') {
        if (!getDesignTypes(state.productType).includes(action.designType)) return state;
        return {
            ...state,
            designTypes: toggleDesignType(state.designTypes, action.designType),
        };
    }

    return state;
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
