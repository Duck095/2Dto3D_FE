export function getPrintDraftDimensions(value, scale = {}) {
    const parsed = String(value ?? '').match(/-?\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
    if (!parsed || parsed.length !== 3 || parsed.some(number => !Number.isFinite(number) || number <= 0)) return null;

    const multiplier = String(value).toLowerCase().includes('cm') ? 10 : 1;
    const dimensions = ['x', 'y', 'z'].map((axis, index) => {
        const axisScale = Number(scale?.[axis]);
        const safeScale = Number.isFinite(axisScale) && axisScale > 0 ? axisScale : 100;
        return Number((parsed[index] * multiplier * safeScale / 100).toFixed(1));
    });

    if (dimensions.some(number => !Number.isFinite(number) || number <= 0)) return null;
    return { x: dimensions[0], y: dimensions[1], z: dimensions[2] };
}

export function isValidPrintDraft(draft) {
    const partsValid = draft?.parts === undefined
        || Array.isArray(draft.parts) && draft.parts.every(part => (
            part && typeof part === 'object' && (typeof part.id === 'string' || typeof part.id === 'number')
        ));
    const scaleValid = draft?.modelScale === undefined || draft.modelScale === null || (
        typeof draft.modelScale === 'object'
        && !Array.isArray(draft.modelScale)
        && ['x', 'y', 'z'].every(axis => draft.modelScale[axis] === undefined
            || Number.isFinite(Number(draft.modelScale[axis])) && Number(draft.modelScale[axis]) > 0)
    );

    return Boolean(
        draft
        && typeof draft === 'object'
        && !Array.isArray(draft)
        && typeof draft.modelUrl === 'string'
        && draft.modelUrl.trim()
        && (typeof draft.productName === 'string' && draft.productName.trim()
            || typeof draft.title === 'string' && draft.title.trim())
        && partsValid
        && scaleValid
        && getPrintDraftDimensions(draft.dimensions, draft.modelScale),
    );
}

export function scalePrintDimensions(baseDimensions, axis, rawValue) {
    const requestedValue = Number(rawValue);
    if (!['x', 'y', 'z'].includes(axis)
        || !Number.isFinite(requestedValue)
        || requestedValue <= 0
        || !baseDimensions
        || ['x', 'y', 'z'].some(key => !Number.isFinite(baseDimensions[key]) || baseDimensions[key] <= 0)) {
        return baseDimensions;
    }

    const nextValue = Math.min(1000, Math.max(0.1, requestedValue));
    const multiplier = nextValue / baseDimensions[axis];
    return Object.fromEntries(['x', 'y', 'z'].map(key => [
        key,
        Number((baseDimensions[key] * multiplier).toFixed(1)),
    ]));
}

export function getDimensionScalePercentages(referenceDimensions, currentDimensions) {
    if (!referenceDimensions || !currentDimensions
        || ['x', 'y', 'z'].some(axis => (
            !Number.isFinite(referenceDimensions[axis]) || referenceDimensions[axis] <= 0
            || !Number.isFinite(currentDimensions[axis]) || currentDimensions[axis] <= 0
        ))) {
        return null;
    }

    return Object.fromEntries(['x', 'y', 'z'].map(axis => [
        axis,
        Math.round(currentDimensions[axis] / referenceDimensions[axis] * 100),
    ]));
}
