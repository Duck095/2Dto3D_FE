export const STUDIO_SIDEBAR_STORAGE_KEY = '2dto3d.ai-studio.sidebar-width';
export const STUDIO_SIDEBAR_COLLAPSED_STORAGE_KEY = '2dto3d.ai-studio.sidebar-collapsed';
export const DEFAULT_STUDIO_SIDEBAR_WIDTH = 360;
export const MIN_STUDIO_SIDEBAR_WIDTH = 272;
export const MAX_STUDIO_SIDEBAR_WIDTH = 960;
export const MIN_STUDIO_VIEWER_WIDTH = 360;
export const DEFAULT_STUDIO_HISTORY_MIN_WIDTH = 250;

const MIN_STORED_WIDTH = 260;
const MAX_STORED_WIDTH = 2000;

export function getStudioSidebarBounds(workspaceWidth, gap = 18, historyMinWidth = DEFAULT_STUDIO_HISTORY_MIN_WIDTH) {
    if (!Number.isFinite(workspaceWidth) || workspaceWidth <= 0) {
        return { min: MIN_STUDIO_SIDEBAR_WIDTH, max: MIN_STUDIO_SIDEBAR_WIDTH };
    }

    const max = Math.max(0, Math.floor(Math.min(
        MAX_STUDIO_SIDEBAR_WIDTH,
        workspaceWidth * 0.5,
        workspaceWidth - Math.max(0, gap) - MIN_STUDIO_VIEWER_WIDTH - Math.max(0, historyMinWidth),
    )));
    return { min: Math.min(MIN_STUDIO_SIDEBAR_WIDTH, max), max };
}

export function clampStudioSidebarWidth(width, workspaceWidth, gap = 18, historyMinWidth = DEFAULT_STUDIO_HISTORY_MIN_WIDTH) {
    const { min, max } = getStudioSidebarBounds(workspaceWidth, gap, historyMinWidth);
    const requested = Number.isFinite(width) ? width : DEFAULT_STUDIO_SIDEBAR_WIDTH;
    return Math.round(Math.max(min, Math.min(max, requested)));
}

export function getStudioSidebarKeyboardWidth(currentWidth, key, bounds, step = 16) {
    if (!bounds || !Number.isFinite(currentWidth) || !Number.isFinite(step) || step <= 0) return null;
    let requested;
    if (key === 'ArrowLeft') requested = currentWidth - step;
    else if (key === 'ArrowRight') requested = currentWidth + step;
    else if (key === 'Home') requested = bounds.min;
    else if (key === 'End') requested = bounds.max;
    else return null;
    return Math.round(Math.max(bounds.min, Math.min(bounds.max, requested)));
}

export function readStudioSidebarWidth(storage, fallback = DEFAULT_STUDIO_SIDEBAR_WIDTH) {
    try {
        const raw = storage?.getItem(STUDIO_SIDEBAR_STORAGE_KEY);
        if (typeof raw !== 'string' || !raw.trim()) return fallback;
        const width = Number(raw);
        return Number.isFinite(width) && width >= MIN_STORED_WIDTH && width <= MAX_STORED_WIDTH
            ? Math.round(width)
            : fallback;
    } catch {
        return fallback;
    }
}

export function writeStudioSidebarWidth(storage, width) {
    if (!storage || typeof storage.setItem !== 'function'
        || !Number.isFinite(width) || width < MIN_STORED_WIDTH || width > MAX_STORED_WIDTH) return false;
    try {
        storage?.setItem(STUDIO_SIDEBAR_STORAGE_KEY, String(Math.round(width)));
        return true;
    } catch {
        return false;
    }
}

export function readStudioSidebarCollapsed(storage) {
    try {
        return storage?.getItem(STUDIO_SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function writeStudioSidebarCollapsed(storage, collapsed) {
    if (!storage || typeof storage.setItem !== 'function' || typeof collapsed !== 'boolean') return false;
    try {
        storage.setItem(STUDIO_SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
        return true;
    } catch {
        return false;
    }
}
