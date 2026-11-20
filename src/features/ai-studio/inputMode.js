export function getStudioInputMode(search, modelEditDraft = null) {
    if (modelEditDraft) return modelEditDraft.imageDataUrl ? 'image' : 'text';
    const requestedMode = new URLSearchParams(search).get('mode');
    return requestedMode === 'image' || requestedMode === 'text' ? requestedMode : 'text';
}

export function getNextStudioInputMode(currentMode, key, modes = ['text', 'image', 'multi']) {
    if (!Array.isArray(modes) || modes.length === 0) return null;
    if (key === 'Home') return modes[0];
    if (key === 'End') return modes[modes.length - 1];

    const direction = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
    const currentIndex = modes.indexOf(currentMode);
    if (!direction || currentIndex < 0) return null;
    return modes[(currentIndex + direction + modes.length) % modes.length];
}
