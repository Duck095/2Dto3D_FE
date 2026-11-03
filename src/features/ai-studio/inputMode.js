export function getStudioInputMode(search, modelEditDraft = null) {
    if (modelEditDraft) return modelEditDraft.imageDataUrl ? 'image' : 'text';
    const requestedMode = new URLSearchParams(search).get('mode');
    return requestedMode === 'image' || requestedMode === 'text' ? requestedMode : 'text';
}
